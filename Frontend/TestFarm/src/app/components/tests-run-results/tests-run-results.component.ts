import * as pako from 'pako';

import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestsRunResultDescription } from '../../models/tests-run-result-description';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';
import { catchError, retry, tap, throwError, of } from 'rxjs';
import { TestsRunResultDiffDescription } from 'src/app/models/tests-run-result-diff-description';
import { TestsRunDetailsDescription } from 'src/app/models/tests-run-details-description';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Artifact } from 'src/app/models/artifact';

Chart.register(...registerables);

class TestsRunResultDescriptionRow {
  active: boolean = false;
  checked: boolean = false;

  showDetails: boolean = false;
  showDiffs: boolean = false;
  showHistory: boolean = false;

  constructor(public result: TestsRunResultDescription) {}
}

@Component({
  selector: 'app-tests-run-results',
  templateUrl: './tests-run-results.component.html',
  styleUrls: ['./tests-run-results.component.css']
})
export class TestsRunResultsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('resultsChart', { static: false }) statusChartRef!: ElementRef<HTMLCanvasElement>;

  testsRunId: string | null = null;

  testsRunDetails: TestsRunDetailsDescription | null = null;

  testsRunResults: TestsRunResultDescription[] = [];

  testsRunResultsRows: TestsRunResultDescriptionRow[] = [];
  filteredTestsRunResultsRows: TestsRunResultDescriptionRow[] = [];

  sortDirection: { [key: string]: 'asc' | 'desc' } = {};

  searchTerm: string = '';

  statusChart: Chart | null = null;
  private viewInitialized = false;

  constructor(private route: ActivatedRoute, private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.testsRunId = this.route.snapshot.paramMap.get('testsRunId');
    console.log('Fetched testsRunId:', this.testsRunId);

    this.fetchTestsRunDetailsData();
    this.fetchTestsRunResultsData();
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    console.log('View initialized, statusChartRef:', this.statusChartRef);

    // Use setTimeout to ensure the view is fully rendered
    setTimeout(() => {
      if (this.testsRunDetails) {
        this.createStatusChart(this.testsRunDetails);
      }
    }, 0);
  }

  ngOnDestroy() {
    if (this.statusChart) {
      this.statusChart.destroy();
    }
  }

  private fetchTestsRunResultsData() {
    if (this.testsRunId) {
      this.testsApiHttpClientService.getAllTestsRunResultsData(this.testsRunId).pipe(
        tap({
          next: (data: TestsRunResultDescription[]) => {
            this.testsRunResults = data;
            this.testsRunResultsRows = data.map(result => new TestsRunResultDescriptionRow(result));
            this.filteredTestsRunResultsRows = [...this.testsRunResultsRows];
          }
        }),
        catchError((error: any) => {
          console.error('Error fetching tests run results data:', error);
          return of([]);
        })
      ).subscribe();


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

  private fetchTestsRunDetailsData() {
    if (this.testsRunId) {
      this.testsApiHttpClientService.getTestsRunDetails(this.testsRunId).subscribe(
        (data: TestsRunDetailsDescription) => {
          this.testsRunDetails = data;
          console.log('Fetched tests run details:', this.testsRunDetails);

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

  private createStatusChart(testsRunDetails: TestsRunDetailsDescription) {
    if (!testsRunDetails) {
      console.log('No test run details available for chart creation.');
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
      this.createChartWithContext(ctx, testsRunDetails);
      return;
    }

    const ctx = this.statusChartRef.nativeElement;
    console.log('Creating status chart with ViewChild canvas, data:', testsRunDetails);
    this.createChartWithContext(ctx, testsRunDetails);
  }

  private createChartWithContext(ctx: HTMLCanvasElement, testsRunDetails: TestsRunDetailsDescription) {
    const testCounts = [
      testsRunDetails.PassedTests,
      testsRunDetails.FailedTests,
      testsRunDetails.RunningTests,
      testsRunDetails.QueuedTests,
      0
    ];

    const data = {
      labels: [
        `Passed (${testsRunDetails.PassedTests})`,
        `Failed (${testsRunDetails.FailedTests})`,
        `Running (${testsRunDetails.RunningTests})`,
        `Queued (${testsRunDetails.QueuedTests})`,
        `Total (${testsRunDetails.PassedTests + testsRunDetails.FailedTests + testsRunDetails.RunningTests + testsRunDetails.QueuedTests})`
      ],
      datasets: [{
        data: testCounts,
        backgroundColor: [
          '#4caf50', // Green for passed
          '#f44336', // Red for failed
          '#ff9800', // Orange for running
          '#2196f3', // Blue for queued
          '#ffffff00' // Transparent for total
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
                const total = this.testsRunDetails!.TotalTests;
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

  downloadTempDirArchive(testResultId: number) {
    this.testsApiHttpClientService.downloadTempDirArchive(testResultId).subscribe(
      (response: Blob) => {
        const blob = new Blob([response], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `temp_dir_${testResultId}.7z`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      },
      (error: any) => {
        console.error('Error downloading archive:', error);
      }
    );
  }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
      const tableRows = document.querySelectorAll('#testsRunsTable tbody tr#result');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredTestsRunResultsRows.length) {
          const row = this.filteredTestsRunResultsRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: TestsRunResultDescriptionRow, isHovering: boolean): void {
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

  markRowReviewed(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
    row.checked = true;

    this.filteredTestsRunResultsRows.forEach(row => row.active = false);
    row.active = true;

    this.renderAllRows();
  }

  removeRowFromReviewed(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
    row.checked = false;
    this.filteredTestsRunResultsRows.forEach(row => row.active = false);

    this.renderAllRows();
  }

  onRowMouseOver(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: TestsRunResultDescriptionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredTestsRunResultsRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Get the values to compare based on column
      switch (column) {
        case 'name':
          aValue = a.result.TestName;
          bValue = b.result.TestName;
          break;
        case 'path':
          aValue = a.result.TestPath;
          bValue = b.result.TestPath;
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

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filterData();
  }

  filterData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredTestsRunResultsRows = [...this.testsRunResultsRows];
    } else {
      this.filteredTestsRunResultsRows = this.testsRunResultsRows.filter(row => {
        const testsRun = row.result;

        // Search across all relevant fields
        const searchableContent = [
          testsRun.TestPath || '',
          testsRun.TestName || '',
        ].join(' ').toLowerCase();

        return searchableContent.includes(this.searchTerm);
      });
    }

    this.renderAllRows();
  }

  calculateExecutionTime(result: TestsRunResultDescription): string {
    if (result.ExecutionStartTimestamp == null || result.ExecutionEndTimestamp == null) {
      return 'N/A';
    }
    const startTime = new Date(result.ExecutionStartTimestamp);
    const endTime = new Date(result.ExecutionEndTimestamp);

    const duration = endTime.getTime() - startTime.getTime();

    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);

    return `${minutes}m ${seconds}s`;
  }


  showReport(testResultDiffId: number) {
    this.testsApiHttpClientService.getDiff(testResultDiffId).subscribe(
      (data: TestsRunResultDiffDescription) => {
        let report = data.Report;
        if (report && report.length > 0) {
          try {
            // Decode base64
            const decodedReport = atob(report);

            // Convert the decoded string to a Uint8Array
            const binaryString = atob(report);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Decompress the zipped content using pako
            const decompressedReport = pako.ungzip(bytes, { to: 'string' });

            // Determine the content type (assuming HTML or plain text)
            const isHtml = decompressedReport.trim().startsWith('<');
            const mimeType = isHtml ? 'text/html' : 'text/plain';

            // Create a blob from the decompressed report
            const blob = new Blob([decompressedReport], { type: mimeType });

            // Create a URL for the blob
            const url = URL.createObjectURL(blob);

            // Open the URL in a new window
            window.open(url, '_blank');

            // Clean up by revoking the object URL after a delay
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 1000);
          } catch (error) {
            console.error('Error processing report:', error);
          }
        }
      },
      (error: any) => {
        console.error('Error fetching diff data:', error);
      }
    );
  }

  getArtifactNames(artifacts: Artifact[]): string {
    return artifacts.map(artifact => artifact.BuildName).join(', ');
  }

  testsRunningOrQueued(): boolean {
    return this.filteredTestsRunResultsRows.some(row => row.result.Status === 'running' || row.result.Status === 'queued');
  }

  enableCancelButton(): boolean {
    return this.testsRunId !== null && this.testsRunningOrQueued();
  }

  cancelTestsRun(): void {
    if (this.testsRunId !== null && this.testsRunningOrQueued()) {
      this.testsApiHttpClientService.cancelTestsRun(this.testsRunId).subscribe(
        (response: { message: string }) => {
          console.log('Tests run cancelled successfully:', response);
          this.fetchTestsRunResultsData();
        },
        (error) => {
          console.error('Error cancelling tests run:', error);
          // Handle error (e.g., show an error notification)
        }
      );
    }
  }
}
