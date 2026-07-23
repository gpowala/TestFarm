import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { SuiteStatisticsResponse, SuiteStatisticsEntry, SuiteRunArtifact } from '../../../models/suite-statistics';
import { TestsApiHttpClientService } from '../../../services/tests-api-http-cient-service';

Chart.register(...registerables);

interface ArtifactFilterOption {
  repository: string;
  branch: string;
  label: string;
  selected: boolean;
}

@Component({
  selector: 'app-suite-statistics-dialog',
  templateUrl: './suite-statistics-dialog.component.html',
  styleUrls: ['./suite-statistics-dialog.component.css']
})
export class SuiteStatisticsDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() repositoryName!: string;
  @Input() suiteName!: string;
  @Output() dialogClosed = new EventEmitter<void>();

  @ViewChild('progressChart', { static: false }) progressChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('durationChart', { static: false }) durationChartRef!: ElementRef<HTMLCanvasElement>;

  statisticsData: SuiteStatisticsResponse | null = null;
  isLoading: boolean = true;
  errorMessage: string = '';

  progressChart: Chart | null = null;
  durationChart: Chart | null = null;

  // Filter options
  chartType: 'line' | 'bar' = 'bar';
  showTestPassingLine: boolean = true;
  showTestFailingLine: boolean = false;
  showDiffPassingLine: boolean = true;
  showDiffFailingLine: boolean = false;
  dateRange: 'all' | 'week' | 'month' | '3months' = 'month';

  // Artifact filtering
  artifactFilterOptions: ArtifactFilterOption[] = [];
  showArtifactFilter: boolean = false;

  private viewInitialized = false;

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit(): void {
    this.fetchStatistics();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    if (this.statisticsData) {
      setTimeout(() => this.createCharts(), 0);
    }
  }

  ngOnDestroy(): void {
    if (this.progressChart) {
      this.progressChart.destroy();
    }
    if (this.durationChart) {
      this.durationChart.destroy();
    }
  }

  fetchStatistics(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.testsApiHttpClientService.getSuiteStatistics(this.repositoryName, this.suiteName).subscribe(
      (data: SuiteStatisticsResponse) => {
        this.statisticsData = data;
        this.buildArtifactFilterOptions();
        this.isLoading = false;

        if (this.viewInitialized) {
          setTimeout(() => this.createCharts(), 0);
        }
      },
      (error: any) => {
        console.error('Error fetching suite statistics:', error);
        this.errorMessage = 'Failed to load suite statistics. Please try again.';
        this.isLoading = false;
      }
    );
  }

  private buildArtifactFilterOptions(): void {
    if (!this.statisticsData) return;

    const uniqueArtifacts = new Map<string, ArtifactFilterOption>();

    for (const entry of this.statisticsData.statistics) {
      for (const artifact of entry.artifacts) {
        const key = `${artifact.repository}|${artifact.branch}`;
        if (!uniqueArtifacts.has(key)) {
          uniqueArtifacts.set(key, {
            repository: artifact.repository,
            branch: artifact.branch,
            label: `${artifact.repository} / ${artifact.branch}`,
            selected: true
          });
        }
      }
    }

    this.artifactFilterOptions = Array.from(uniqueArtifacts.values());
  }

  toggleArtifactFilter(): void {
    this.showArtifactFilter = !this.showArtifactFilter;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.showArtifactFilter && !target.closest('.artifact-filter-dropdown')) {
      this.showArtifactFilter = false;
    }
  }

  onArtifactFilterChange(): void {
    this.createCharts();
  }

  selectAllArtifacts(): void {
    this.artifactFilterOptions.forEach(opt => opt.selected = true);
    this.createCharts();
  }

  deselectAllArtifacts(): void {
    this.artifactFilterOptions.forEach(opt => opt.selected = false);
    this.createCharts();
  }

  private getFilteredStatistics(): SuiteStatisticsEntry[] {
    if (!this.statisticsData) return [];

    let stats = [...this.statisticsData.statistics];

    // Apply artifact filter
    const selectedArtifacts = this.artifactFilterOptions.filter(opt => opt.selected);
    if (selectedArtifacts.length > 0 && selectedArtifacts.length < this.artifactFilterOptions.length) {
      stats = stats.filter(entry => {
        return entry.artifacts.some(artifact =>
          selectedArtifacts.some(filter =>
            filter.repository === artifact.repository && filter.branch === artifact.branch
          )
        );
      });
    }

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

      stats = stats.filter(s => new Date(s.testRun.timestamp) >= cutoffDate);
    }

    // Sort by timestamp ascending
    stats.sort((a, b) =>
      new Date(a.testRun.timestamp).getTime() - new Date(b.testRun.timestamp).getTime()
    );

    return stats;
  }

  private createCharts(): void {
    this.createProgressChart();
    this.createDurationChart();
  }

  private createProgressChart(): void {
    if (!this.progressChartRef || !this.progressChartRef.nativeElement) {
      console.log('Canvas element not found');
      return;
    }

    const filteredStats = this.getFilteredStatistics();

    if (filteredStats.length === 0) {
      if (this.progressChart) {
        this.progressChart.destroy();
        this.progressChart = null;
      }
      return;
    }

    // Destroy existing chart if any
    if (this.progressChart) {
      this.progressChart.destroy();
    }

    const ctx = this.progressChartRef.nativeElement;

    // Prepare data
    const labels = filteredStats.map(s => {
      const date = new Date(s.testRun.timestamp);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    });

    const testPassingData = filteredStats.map(s => s.testStatistics.passedPercentage);
    const testFailingData = filteredStats.map(s => {
      const failRate = s.testStatistics.total > 0
        ? (s.testStatistics.failed / s.testStatistics.total) * 100
        : 0;
      return Math.round(failRate * 100) / 100;
    });
    const diffPassingData = filteredStats.map(s => s.diffStatistics.passingPercentage ?? 0);
    const diffFailingData = filteredStats.map(s => {
      if (s.diffStatistics.passingPercentage === null) return 0;
      return 100 - s.diffStatistics.passingPercentage;
    });

    const datasets: any[] = [];

    if (this.showTestPassingLine) {
      datasets.push({
        label: 'Tests Passing %',
        data: testPassingData,
        borderColor: '#4caf50',
        backgroundColor: this.chartType === 'bar' ? 'rgba(76, 175, 80, 0.7)' : 'rgba(76, 175, 80, 0.1)',
        fill: this.chartType === 'line',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (this.showTestFailingLine) {
      datasets.push({
        label: 'Tests Failing %',
        data: testFailingData,
        borderColor: '#f44336',
        backgroundColor: this.chartType === 'bar' ? 'rgba(244, 67, 54, 0.7)' : 'rgba(244, 67, 54, 0.1)',
        fill: this.chartType === 'line',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (this.showDiffPassingLine) {
      datasets.push({
        label: 'Diffs Passing %',
        data: diffPassingData,
        borderColor: '#2196f3',
        backgroundColor: this.chartType === 'bar' ? 'rgba(33, 150, 243, 0.7)' : 'rgba(33, 150, 243, 0.1)',
        fill: this.chartType === 'line',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      });
    }

    if (this.showDiffFailingLine) {
      datasets.push({
        label: 'Diffs Failing %',
        data: diffFailingData,
        borderColor: '#ff9800',
        backgroundColor: this.chartType === 'bar' ? 'rgba(255, 152, 0, 0.7)' : 'rgba(255, 152, 0, 0.1)',
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
                const lines = [
                  '',
                  `Tests: ${stat.testStatistics.passed}/${stat.testStatistics.total} passed`,
                  `Diffs: ${stat.diffStatistics.passing}/${stat.diffStatistics.total} passing`,
                  '',
                  `Run: ${stat.testRun.name}`,
                  `Status: ${stat.testRun.overallStatus}`
                ];
                if (stat.artifacts.length > 0) {
                  lines.push(`Build: ${stat.artifacts[0].buildName}`);
                }
                return lines;
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

  private createDurationChart(): void {
    if (!this.durationChartRef || !this.durationChartRef.nativeElement) {
      return;
    }

    const filteredStats = this.getFilteredStatistics();

    if (this.durationChart) {
      this.durationChart.destroy();
      this.durationChart = null;
    }

    if (filteredStats.length === 0) {
      return;
    }

    const ctx = this.durationChartRef.nativeElement;

    const labels = filteredStats.map(s => {
      const date = new Date(s.testRun.timestamp);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    });

    // Plot minutes; null (unfinished runs) leaves a gap.
    const durationMinutes = filteredStats.map(s => {
      const ms = s.durationStatistics?.durationMs ?? null;
      return ms != null ? Math.round((ms / 60000) * 100) / 100 : null;
    });

    const config: ChartConfiguration = {
      type: this.chartType,
      data: {
        labels: labels,
        datasets: [{
          label: 'Run Duration',
          data: durationMinutes as any,
          borderColor: '#673ab7',
          backgroundColor: this.chartType === 'bar' ? 'rgba(103, 58, 183, 0.7)' : 'rgba(103, 58, 183, 0.1)',
          fill: this.chartType === 'line',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: true
        }]
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
              label: (context) => {
                const stat = filteredStats[context.dataIndex];
                const ms = stat.durationStatistics?.durationMs ?? null;
                return ms != null ? `Duration: ${this.formatDuration(ms)}` : 'Duration: N/A (not finished)';
              },
              afterBody: (context) => {
                const stat = filteredStats[context[0].dataIndex];
                const lines = [
                  '',
                  `Run: ${stat.testRun.name}`,
                  `Status: ${stat.testRun.overallStatus}`
                ];
                if (stat.artifacts.length > 0) {
                  lines.push(`Build: ${stat.artifacts[0].buildName}`);
                }
                return lines;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutes'
            },
            ticks: {
              callback: (value) => value + 'm'
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

    this.durationChart = new Chart(ctx, config);
  }

  formatDuration(ms: number | null): string {
    if (ms == null) {
      return 'N/A';
    }
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  getLatestDuration(): string {
    if (!this.statisticsData || this.statisticsData.statistics.length === 0) {
      return 'N/A';
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.testRun.timestamp).getTime() - new Date(a.testRun.timestamp).getTime()
    );
    return this.formatDuration(sorted[0].durationStatistics?.durationMs ?? null);
  }

  onChartTypeChange(): void {
    this.createCharts();
  }

  onFilterChange(): void {
    this.createCharts();
  }

  onDateRangeChange(): void {
    this.createCharts();
  }

  onClose(): void {
    this.dialogClosed.emit();
  }

  getLatestTestProgress(): number {
    if (!this.statisticsData || this.statisticsData.statistics.length === 0) {
      return 0;
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.testRun.timestamp).getTime() - new Date(a.testRun.timestamp).getTime()
    );
    return sorted[0].testStatistics.passedPercentage;
  }

  getLatestDiffProgress(): number {
    if (!this.statisticsData || this.statisticsData.statistics.length === 0) {
      return 0;
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.testRun.timestamp).getTime() - new Date(a.testRun.timestamp).getTime()
    );
    return sorted[0].diffStatistics.passingPercentage ?? 0;
  }

  getTrendDirection(): 'up' | 'down' | 'stable' {
    if (!this.statisticsData || this.statisticsData.statistics.length < 2) {
      return 'stable';
    }
    const sorted = [...this.statisticsData.statistics].sort((a, b) =>
      new Date(b.testRun.timestamp).getTime() - new Date(a.testRun.timestamp).getTime()
    );
    const latest = sorted[0].testStatistics.passedPercentage;
    const previous = sorted[1].testStatistics.passedPercentage;

    if (latest > previous) return 'up';
    if (latest < previous) return 'down';
    return 'stable';
  }

  getSelectedArtifactCount(): number {
    return this.artifactFilterOptions.filter(o => o.selected).length;
  }
}
