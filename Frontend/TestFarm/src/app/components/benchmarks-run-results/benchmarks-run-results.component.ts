import * as pako from 'pako';

import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestsRunResultDescription } from '../../models/tests-run-result-description';
import { BenchmarksApiHttpClientService } from '../../services/benchmarks-api-http-cient-service';
import { catchError, retry, tap, throwError, of } from 'rxjs';
import { TestsRunResultDiffDescription } from 'src/app/models/tests-run-result-diff-description';
import { BenchmarkResultDescription } from 'src/app/models/benchmark-result-description';
import { BenchmarksRunDetailsDescription } from 'src/app/models/benchmarks-run-details-description';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BenchmarkResultDetailsDescription } from 'src/app/models/benchmark-result-details-description';
import { BenchmarkResultMeasurements, ProcessedCombinedMetrics, calculateCombinedStepsMetrics } from 'src/app/models/benchmark-result-measurements';

Chart.register(...registerables);

class BenchmarksResultDescriptionRow {
  active: boolean = false;
  checked: boolean = false;

  showDetails: boolean = false;
  showDiffs: boolean = false;
  showHistory: boolean = false;

  baseMeasurements: BenchmarkResultMeasurements | null = null;
  processedStepsCombinedMetrics: ProcessedCombinedMetrics[] | null = null;
  processedOverallCombinedMetrics: ProcessedCombinedMetrics | null = null;

  // Dropdown related
  iterationOptions: (string | number)[] = ['C'];
  selectedIteration: string | number = 'C';

  constructor(public result: BenchmarkResultDescription) {}
}

@Component({
  selector: 'app-benchmarks-run-results',
  templateUrl: './benchmarks-run-results.component.html',
  styleUrls: ['./benchmarks-run-results.component.css']
})
export class BenchmarksRunResultsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('resultsChart', { static: false }) statusChartRef!: ElementRef<HTMLCanvasElement>;

  benchmarksRunId: string | null = null;

  benchmarksRunDetails: BenchmarksRunDetailsDescription | null = null;

  benchmarksResults: BenchmarkResultDescription[] = [];

  benchmarksResultsRows: BenchmarksResultDescriptionRow[] = [];
  filteredBenchmarksResultsRows: BenchmarksResultDescriptionRow[] = [];

  sortDirection: { [key: string]: 'asc' | 'desc' } = {};

  searchTerm: string = '';

  statusChart: Chart | null = null;
  private viewInitialized = false;

  public iterationsViewPresets: { [key: string]: string } = {
    'combined': 'Show combined iterations results',
    'individual': 'Show individual iterations results'
  };
  public selectedIterationsView: string = 'combined';

  constructor(private route: ActivatedRoute, private benchmarksApiHttpClientService: BenchmarksApiHttpClientService) {}

  ngOnInit() {
    this.benchmarksRunId = this.route.snapshot.paramMap.get('benchmarksRunId');
    console.log('Fetched benchmarksRunId:', this.benchmarksRunId);

    this.fetchBenchmarksRunDetails();
    this.fetchBenchmarksRunResults();
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    console.log('View initialized, statusChartRef:', this.statusChartRef);

    // Use setTimeout to ensure the view is fully rendered
    setTimeout(() => {
      if (this.benchmarksRunDetails) {
        this.createStatusChart(this.benchmarksRunDetails);
      }
    }, 0);
  }

  ngOnDestroy() {
    if (this.statusChart) {
      this.statusChart.destroy();
    }
  }

  private fetchBenchmarksRunResults() {
    if (this.benchmarksRunId) {
      this.benchmarksApiHttpClientService
        .getAllBenchmarksRunResults(this.benchmarksRunId!)
        .subscribe({
          next: (data: BenchmarkResultDescription[]) => {
            this.benchmarksResults = data;
            this.benchmarksResultsRows = data.map(r => new BenchmarksResultDescriptionRow(r));
            this.filteredBenchmarksResultsRows = [...this.benchmarksResultsRows];

            // after fetching the list, get details for each benchmark
            this.benchmarksResultsRows.forEach(row => {
              this.benchmarksApiHttpClientService
                .getBenchmarkResultDetails(row.result.Id.toString())
                .subscribe({
                  next: (details) => {
                    row.baseMeasurements = this.unpackMeasurements(details.Results);
                    this.updateIterationOptions(row);
                    console.log(`Fetched details for benchmark ${row.result.Id}`);

                    if (row.baseMeasurements) {
                      const processedMetrics = calculateCombinedStepsMetrics(row.baseMeasurements);

                      row.processedStepsCombinedMetrics = processedMetrics.slice(0, processedMetrics.length - 1);
                      row.processedOverallCombinedMetrics = processedMetrics[processedMetrics.length - 1];

                      console.log(`Processed steps combined metrics for benchmark ${row.result.Id}:`, row.processedStepsCombinedMetrics);
                      console.log(`Processed overall combined metrics for benchmark ${row.result.Id}:`, row.processedOverallCombinedMetrics);
                    }
                  },
                  error: (err) => {
                    console.error(`Error fetching details for benchmark ${row.result.Id}:`, err);
                  }
                });
            });
          },
          error: (error: any) => {
            console.error('Error fetching benchmarks run results data:', error);
          }
        });


      // this.testsApiHttpClientService.getAllTestsRunResultsData(this.testsRunId).subscribe(
      //   (data: TestsRunResultDescription[]) => {
      //     this.testsRunResults = data;
      //   },
      //   (error: any) => {
      //     console.error('Error fetching tests run results data:', error);
      //   }
      // );
    }
  }

  private fetchBenchmarksRunDetails() {
    if (this.benchmarksRunId) {
      this.benchmarksApiHttpClientService.getBenchmarksRunDetails(this.benchmarksRunId).subscribe(
        (data: BenchmarksRunDetailsDescription) => {
          this.benchmarksRunDetails = data;
          console.log('Fetched benchmarks run details:', this.benchmarksRunDetails);

          // Only create chart if view is initialized, with a small delay to ensure DOM is ready
          if (this.viewInitialized) {
            setTimeout(() => {
              this.createStatusChart(data);
            }, 100);
          }
        },
        (error: any) => {
          console.error('Error fetching tests run details data:', error);
        }
      );
    }
  }

  private createStatusChart(benchmarksRunDetails: BenchmarksRunDetailsDescription) {
    if (!benchmarksRunDetails) {
      console.log('No benchmarks run details available for chart creation.');
      return;
    }

    console.log('Attempting to create chart, statusChartRef:', this.statusChartRef);

    if (!this.statusChartRef || !this.statusChartRef.nativeElement) {
      console.log('Canvas element not found via ViewChild, trying direct DOM access as fallback...');

      // Fallback to direct DOM access
      const ctx = document.querySelector('canvas[data-chart="results"]') as HTMLCanvasElement;
      if (!ctx) {
        console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked');
        return;
      }

      console.log('Using fallback canvas element');
      this.createChartWithContext(ctx, benchmarksRunDetails);
      return;
    }

    const ctx = this.statusChartRef.nativeElement;
    console.log('Creating status chart with ViewChild canvas, data:', benchmarksRunDetails);
    this.createChartWithContext(ctx, benchmarksRunDetails);
  }

  private createChartWithContext(ctx: HTMLCanvasElement, benchmarksRunDetails: BenchmarksRunDetailsDescription) {
    const testCounts = [
      benchmarksRunDetails.CompletedBenchmarks,
      benchmarksRunDetails.RunningBenchmarks,
      benchmarksRunDetails.QueuedBenchmarks
    ];

    const data = {
      labels: [
        `Completed (${benchmarksRunDetails.CompletedBenchmarks})`,
        `Running (${benchmarksRunDetails.RunningBenchmarks})`,
        `Queued (${benchmarksRunDetails.QueuedBenchmarks})`
      ],
      datasets: [{
        data: testCounts,
        backgroundColor: [
          '#2196f3',  // Blue for completed
          '#ff9800',  // Orange for running
          '#9e9e9e'   // Grey for queued
        ],
        // borderColor: '#ffffff',
        // borderWidth: 3,
        cutout: '60%',
        hoverOffset: 8,
        // hoverBorderWidth: 4
      }]
    };

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              padding: 15,
              usePointStyle: true,
              pointStyle: 'circle',
              font: {
                size: 13,
                weight: 500
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#ffffff',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed;
                const total = this.benchmarksRunDetails!.TotalBenchmarks;
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                return `${label}: ${value} tests (${percentage}%)`;
              }
            }
          }
        },
        elements: {
          arc: {
            borderRadius: 4
          }
        },
        layout: {
          padding: {
            top: 20,
            bottom: 20,
            left: 10,
            right: 10
          }
        }
      }
    };

    this.statusChart = new Chart(ctx, config);
  }

  // downloadTempDirArchive(testResultId: number) {
  //   this.testsApiHttpClientService.downloadTempDirArchive(testResultId).subscribe(
  //     (response: Blob) => {
  //       const blob = new Blob([response], { type: 'application/zip' });
  //       const url = URL.createObjectURL(blob);
  //       const a = document.createElement('a');
  //       a.href = url;
  //       a.download = `temp_dir_${testResultId}.7z`;
  //       document.body.appendChild(a);
  //       a.click();
  //       URL.revokeObjectURL(url);
  //       a.remove();
  //     },
  //     (error: any) => {
  //       console.error('Error downloading archive:', error);
  //     }
  //   );
  // }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
      const tableRows = document.querySelectorAll('#testsRunsTable tbody tr#result');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredBenchmarksResultsRows.length) {
          const row = this.filteredBenchmarksResultsRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: BenchmarksResultDescriptionRow, isHovering: boolean): void {
    if (row.checked && row.active) {
      element.className = isHovering ? 'row-checked-and-active-hovering' : 'row-checked-and-active';
    } else if (row.checked && !row.active) {
      element.className = isHovering ? 'row-checked-hovering' : 'row-checked';
    } else if (!row.checked && row.active) {
      element.className = isHovering ? 'row-active-hovering' : 'row-active';
    } else {
      element.className = isHovering ? 'row-inactive-hovering' : 'row-inactive';
    }
  }

  // markRowReviewed(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
  //   row.checked = true;

  //   this.filteredTestsRunResultsRows.forEach(row => row.active = false);
  //   row.active = true;

  //   this.renderAllRows();
  // }

  // removeRowFromReviewed(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
  //   row.checked = false;
  //   this.filteredTestsRunResultsRows.forEach(row => row.active = false);

  //   this.renderAllRows();
  // }

  // onRowMouseOver(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
  //   this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  // }

  // onRowMouseOut(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
  //   this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  // }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredBenchmarksResultsRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Get the values to compare based on column
      switch (column) {
        case 'name':
          aValue = a.result.BenchmarkName;
          bValue = b.result.BenchmarkName;
          break;
        case 'path':
          aValue = a.result.BenchmarkPath;
          bValue = b.result.BenchmarkPath;
          break;
        case 'status':
          aValue = a.result.Status;
          bValue = b.result.Status;
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    this.updateSortIndicators(column, direction);

    this.renderAllRows();
  }

  updateSortIndicators(activeColumn: string, direction: 'asc' | 'desc'): void {
    document.querySelectorAll('#testsRunsTable .column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

    const activeSortSvg = document.querySelector(`#testsRunsTable [data-sort="${activeColumn}"] svg`);
    if (activeSortSvg) {
      (activeSortSvg as HTMLElement).style.opacity = '1';
      activeSortSvg.innerHTML = direction === 'asc'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    }
  }

  resetSortIndicators(): void {
    this.sortDirection = {};
    // Use setTimeout to ensure DOM is rendered
    setTimeout(() => {
      document.querySelectorAll('.column-sortable svg').forEach(svg => {
        (svg as HTMLElement).style.opacity = '0.5';
        svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
      });
    }, 0);
  }

  // onSearchChange(event: any): void {
  //   this.searchTerm = event.target.value.toLowerCase();
  //   this.filterData();
  // }

  // filterData(): void {
  //   if (!this.searchTerm.trim()) {
  //     this.filteredTestsRunResultsRows = [...this.testsRunResultsRows];
  //   } else {
  //     this.filteredTestsRunResultsRows = this.testsRunResultsRows.filter(row => {
  //       const testsRun = row.result;

  //       // Search across all relevant fields
  //       const searchableContent = [
  //         testsRun.TestPath || '',
  //         testsRun.TestName || '',
  //       ].join(' ').toLowerCase();

  //       return searchableContent.includes(this.searchTerm);
  //     });
  //   }

  //   this.renderAllRows();
  // }

  formatExecutionTime(duration: number | null): string {
    if (duration === null) {
      return 'N/A';
    }
    const seconds = Math.floor(duration % 60);
    const minutes = Math.floor((duration / 60) % 60);

    return `${minutes}m ${seconds}s`;
  }

  unpackMeasurements(compressedMeasurements: string): BenchmarkResultMeasurements | null {
    if (!compressedMeasurements || compressedMeasurements.length === 0) {
      return null;
    }
    try {
      // Base64 decode into binary string
      const binaryString = atob(compressedMeasurements);

      // Convert binary string to Uint8Array
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const decompressedMeasurements = pako.ungzip(bytes, { to: 'string' }) as string;
      return JSON.parse(decompressedMeasurements);
    } catch (error) {
      console.error('Error processing benchmark measurements:', error);
      return null;
    }
  }

  private buildIterationOptions(row: BenchmarksResultDescriptionRow): (string | number)[] {
    const len = row.baseMeasurements?.iterations?.length ?? 0;
    const numeric = Array.from({ length: len + 1 }, (_, i) => i); // 0..len
    return numeric;
  }

  private updateIterationOptions(row: BenchmarksResultDescriptionRow): void {
    row.iterationOptions = this.buildIterationOptions(row);
    if (!row.iterationOptions.includes(row.selectedIteration)) {
      row.selectedIteration = 0;
    }
  }
}
