import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { TestStatisticsResponse, TestStatisticsEntry } from '../../../models/test-statistics';
import { TestsApiHttpClientService } from '../../../services/tests-api-http-cient-service';

Chart.register(...registerables);

@Component({
  selector: 'app-test-statistics-dialog',
  templateUrl: './test-statistics-dialog.component.html',
  styleUrls: ['./test-statistics-dialog.component.css']
})
export class TestStatisticsDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() testId!: number;
  @Input() testName: string = '';
  @Output() dialogClosed = new EventEmitter<void>();

  @ViewChild('progressChart', { static: false }) progressChartRef!: ElementRef<HTMLCanvasElement>;

  statisticsData: TestStatisticsResponse | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';

  progressChart: Chart | null = null;

  // Filter options
  chartType: 'line' | 'bar' = 'bar';
  showPassingLine: boolean = true;
  showFailingLine: boolean = true;
  dateRange: 'all' | 'week' | 'month' | '3months' = 'month';

  private viewInitialized = false;

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit(): void {
    this.fetchStatistics();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.statisticsData) {
      setTimeout(() => this.createChart(), 0);
    }
  }

  ngOnDestroy(): void {
    if (this.progressChart) {
      this.progressChart.destroy();
    }
  }

  fetchStatistics(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.testsApiHttpClientService.getTestStatistics(this.testId).subscribe(
      (data: TestStatisticsResponse) => {
        this.statisticsData = data;
        this.isLoading = false;

        if (this.viewInitialized) {
          setTimeout(() => this.createChart(), 0);
        }
      },
      (error: any) => {
        console.error('Error fetching test statistics:', error);
        this.errorMessage = 'Failed to load test statistics. Please try again.';
        this.isLoading = false;
      }
    );
  }

  private getFilteredStatistics(): TestStatisticsEntry[] {
    if (!this.statisticsData) return [];

    let stats = [...this.statisticsData.statistics];

    // Apply date range filter
    if (this.dateRange !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (this.dateRange) {
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      stats = stats.filter(s => new Date(s.executionStartTimestamp) >= cutoffDate);
    }

    // Sort by timestamp ascending
    stats.sort((a, b) =>
      new Date(a.executionStartTimestamp).getTime() - new Date(b.executionStartTimestamp).getTime()
    );

    return stats;
  }

  private createChart(): void {
    if (!this.progressChartRef || !this.progressChartRef.nativeElement) {
      console.log('Canvas element not found');
      return;
    }

    const filteredStats = this.getFilteredStatistics();

    if (filteredStats.length === 0) {
      return;
    }

    // Destroy existing chart if any
    if (this.progressChart) {
      this.progressChart.destroy();
    }

    const ctx = this.progressChartRef.nativeElement;

    // Prepare data
    const labels = filteredStats.map(s => {
      const date = new Date(s.executionStartTimestamp);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    });

    const passingData = filteredStats.map(s => s.diffStatistics.passingPercentage);
    const failingData = filteredStats.map(s => 100 - s.diffStatistics.passingPercentage);

    const datasets: any[] = [];

    if (this.showPassingLine) {
      datasets.push({
        label: 'Passing %',
        data: passingData,
        borderColor: '#4caf50',
        backgroundColor: this.chartType === 'bar' ? 'rgba(76, 175, 80, 0.7)' : 'rgba(76, 175, 80, 0.1)',
        fill: this.chartType === 'line',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (this.showFailingLine) {
      datasets.push({
        label: 'Failing %',
        data: failingData,
        borderColor: '#f44336',
        backgroundColor: this.chartType === 'bar' ? 'rgba(244, 67, 54, 0.7)' : 'rgba(244, 67, 54, 0.1)',
        fill: this.chartType === 'line',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    const config: ChartConfiguration = {
      type: this.chartType,
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12,
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
            callbacks: {
              afterBody: (context) => {
                const index = context[0].dataIndex;
                const stat = filteredStats[index];
                return [
                  '',
                  `Total diffs: ${stat.diffStatistics.total}`,
                  `Passing: ${stat.diffStatistics.passing}`,
                  `Failing: ${stat.diffStatistics.failing}`,
                  '',
                  `Run: ${stat.testRun.name}`,
                  `Status: ${stat.testResultStatus}`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (value) => value + '%'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    };

    this.progressChart = new Chart(ctx, config);
  }

  onChartTypeChange(): void {
    this.createChart();
  }

  onFilterChange(): void {
    this.createChart();
  }

  onDateRangeChange(): void {
    this.createChart();
  }

  onClose(): void {
    this.dialogClosed.emit();
  }

  getLatestProgress(): number {
    if (!this.statisticsData || this.statisticsData.statistics.length === 0) {
      return 0;
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.executionStartTimestamp).getTime() - new Date(a.executionStartTimestamp).getTime()
    );
    return sorted[0].diffStatistics.passingPercentage;
  }

  getTrendDirection(): 'up' | 'down' | 'stable' {
    if (!this.statisticsData || this.statisticsData.statistics.length < 2) {
      return 'stable';
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.executionStartTimestamp).getTime() - new Date(a.executionStartTimestamp).getTime()
    );
    const latest = sorted[0].diffStatistics.passingPercentage;
    const previous = sorted[1].diffStatistics.passingPercentage;

    if (latest > previous) return 'up';
    if (latest < previous) return 'down';
    return 'stable';
  }
}
