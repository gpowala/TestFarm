import * as pako from 'pako';

import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestsRunResultDescription } from '../../models/tests-run-result-description';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';
import { catchError, retry, throwError } from 'rxjs';
import { TestsRunResultDiffDescription } from 'src/app/models/tests-run-result-diff-description';
import { TestsRunDetailsDescription } from 'src/app/models/tests-run-details-description';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

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
  statusChart: Chart | null = null;
  private viewInitialized = false;

  constructor(private route: ActivatedRoute, private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.testsRunId = this.route.snapshot.paramMap.get('testsRunId');
    console.log('Fetched testsRunId:', this.testsRunId);

    this.fetchTestsRunDetailsData();
    this.fetchTestsRunResultsData();

    this.testsRunResults = this.testsRunResults.map(result => ({
      ...result,
      ShowDetails: false,
      ShowHistory: false
    }));
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
      this.testsApiHttpClientService.getAllTestsRunResultsData(this.testsRunId).subscribe(
        (data: TestsRunResultDescription[]) => {
          this.testsRunResults = data;
        },
        (error: any) => {
          console.error('Error fetching tests run results data:', error);
        }
      );
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
    const data = {
      labels: ['Passed', 'Failed', 'Running', 'Queued'],
      datasets: [{
        data: [
          testsRunDetails.PassedTests,
          testsRunDetails.FailedTests,
          testsRunDetails.RunningTests,
          testsRunDetails.QueuedTests
        ],
        backgroundColor: [
          '#4caf50', // Green for passed
          '#f44336', // Red for failed
          '#ff9800', // Orange for running
          '#2196f3'  // Blue for queued
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

  onMouseOver(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
  }

  onMouseOut(event: MouseEvent, detailsVisible: boolean) {
    (event.currentTarget as HTMLElement).style.backgroundColor = detailsVisible ? '#f0f0f0' : '';
  }

  calculateExecutionTime(result: TestsRunResultDescription): string {
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
}
