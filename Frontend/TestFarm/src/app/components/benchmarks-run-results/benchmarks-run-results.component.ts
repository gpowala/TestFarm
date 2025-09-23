import * as pako from 'pako';

import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestsRunResultDescription } from '../../models/tests-run-result-description';
import { BenchmarksApiHttpClientService } from '../../services/benchmarks-api-http-cient-service';
import { catchError, retry, tap, throwError, of } from 'rxjs';
import { TestsRunResultDiffDescription } from 'src/app/models/tests-run-result-diff-description';
import { BenchmarkResultDescription } from 'src/app/models/benchmark-result-description';
import { BenchmarksRunDetailsDescription } from 'src/app/models/benchmarks-run-details-description';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { BenchmarkResultDetailsDescription } from 'src/app/models/benchmark-result-details-description';
import { BenchmarkResultMeasurements, ProcessedIterationMetrics, ProcessedCombinedMetrics, calculateCombinedStepsMetrics, calculateCombinedStepsMetricsPerIteration } from 'src/app/models/benchmark-result-measurements';
import { Artifact } from 'src/app/models/artifact';

Chart.register(...registerables);

class ChartControl {
  chartDatasetVisibility: { [key: string]: boolean } = {};

  constructor(public name: string, public chart: Chart, public visible: boolean) {
    this.chartDatasetVisibility = {};
    this.chart.data.datasets?.forEach((dataset, index) => {
      const key = `dataset_${index}`;
      this.chartDatasetVisibility[key] = !dataset.hidden;
    });
  }
}

class BenchmarksResultDescriptionRow {
  active: boolean = false;
  checked: boolean = false;

  showSteps: boolean = false;
  showCharts: boolean = false;

  baseMeasurements: BenchmarkResultMeasurements | null = null;
  processedStepsCombinedMetrics: ProcessedCombinedMetrics[] = [];
  processedOverallCombinedMetrics: ProcessedCombinedMetrics | null = null;

  processedStepsIterationMetrics: ProcessedIterationMetrics[][] = [];
  processedOverallIterationMetrics: ProcessedIterationMetrics[] = [];

  iterationOptions: number[] = [0];
  selectedIteration: number = 0;

  charts: ChartControl[] = [];

  constructor(public result: BenchmarkResultDescription) {}

  destroyAllCharts() {
    this.charts.forEach(chartControl => chartControl.chart.destroy());
    this.charts = [];
  }
}

@Component({
  selector: 'app-benchmarks-run-results',
  templateUrl: './benchmarks-run-results.component.html',
  styleUrls: ['./benchmarks-run-results.component.css']
})
export class BenchmarksRunResultsComponent implements OnInit, AfterViewInit, OnDestroy {
  benchmarksRunId: string | null = null;

  benchmarksRunDetails: BenchmarksRunDetailsDescription | null = null;

  benchmarksResults: BenchmarkResultDescription[] = [];

  benchmarksResultsRows: BenchmarksResultDescriptionRow[] = [];
  filteredBenchmarksResultsRows: BenchmarksResultDescriptionRow[] = [];

  sortDirection: { [key: string]: 'asc' | 'desc' } = {};

  searchTerm: string = '';

  statusChart: Chart | null = null;
  cpuTotalChart: Chart | null = null;
  resultCharts: Map<string, Chart> = new Map(); // Store multiple results charts
  private viewInitialized = false;

  public iterationsViewPresets: { [key: string]: string } = {
    'combined': 'Show combined iterations results',
    'individual': 'Show individual iterations results'
  };
  public selectedIterationsView: string = 'combined';

  public profileViewPresets: { [key: string]: string } = {
    'general': 'General profile',
    'cpu': 'CPU profile',
    'memory-io-network': 'Memory, I/O, Network profile',
    'process': 'Process profile'
  };
  public selectedProfileView: string = 'general';

  public cpuChartLegendDropdownOpen: boolean = false;

  public metricsColumnsVisibility: { [key: string]: boolean } = {
    cpu_efficiency: false,
    cpu_avg_percent: false,
    cpu_max_percent: false,
    cpu_min_percent: false,
    cpu_total_time: false,
    cpu_total_system_time: false,
    cpu_total_user_time: false,

    io_total_read_bytes: false,
    io_total_read_mb: false,
    io_total_write_bytes: false,
    io_total_write_mb: false,

    mem_avg_percent: false,
    mem_avg_rss_bytes: false,
    mem_avg_rss_mb: false,
    mem_max_percent: false,
    mem_max_rss_bytes: false,
    mem_max_rss_mb: false,

    net_avg_connections: false,
    net_max_connections: false,
    net_total_bytes_recv: false,
    net_total_bytes_sent: false,
    net_total_recv_mb: false,
    net_total_sent_mb: false,

    proc_avg_connections: false,
    proc_avg_fd_handles: false,
    proc_avg_threads: false,
    proc_fd_handle_type: false,
    proc_max_connections: false,
    proc_max_fd_handles: false,
    proc_max_threads: false,
    proc_total_context_switches: false
  };

  constructor(
    private route: ActivatedRoute,
    private benchmarksApiHttpClientService: BenchmarksApiHttpClientService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.benchmarksRunId = this.route.snapshot.paramMap.get('benchmarksRunId');
    console.log('Fetched benchmarksRunId:', this.benchmarksRunId);

    this.fetchBenchmarksRunDetails();
    this.fetchBenchmarksRunResults();

    this.changeProfileView();
  }

  ngAfterViewInit() {
    this.viewInitialized = true;
    console.log('View initialized');

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
    if (this.cpuTotalChart) {
      this.cpuTotalChart.destroy();
    }
    // Destroy all results charts
    this.resultCharts.forEach(chart => chart.destroy());
    this.resultCharts.clear();
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

                      const processedIterationsMetrics = calculateCombinedStepsMetricsPerIteration(row.baseMeasurements);
                      processedIterationsMetrics.forEach(metric => {
                        if (!row.processedStepsIterationMetrics[metric.iteration_index]) {
                          row.processedStepsIterationMetrics[metric.iteration_index] = [];
                        }

                        if (metric.combined_iteration_metrics.step_index === -1) {
                          row.processedOverallIterationMetrics[metric.iteration_index] = metric;
                        } else {
                          row.processedStepsIterationMetrics[metric.iteration_index].push(metric);
                        }
                      });

                      console.log(`Processed steps iteration metrics for benchmark ${row.result.Id}:`, row.processedStepsIterationMetrics);
                      console.log(`Processed overall iteration metrics for benchmark ${row.result.Id}:`, row.processedOverallIterationMetrics);
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

  toggleBenchmarkCharts(row: BenchmarksResultDescriptionRow) {
    // Toggle the visibility of the benchmark charts for the specified row
    row.showCharts = !row.showCharts;

    // Use setTimeout to allow the DOM to update and render the canvas element
    setTimeout(() => {
      if (row.showCharts) {
        this.createCPUUserChart(row);
        this.createCPUSystemChart(row);
        this.createCPUPercentChart(row);

        this.createRAMChart(row);

        this.createIOReadChart(row);
        this.createIOWriteChart(row);

        this.createNetworkRecvChart(row);
        this.createNetworkSentChart(row);
      } else {
        row.destroyAllCharts();
      }
    }, 0);
  }

  createCPUUserChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-cpu-user-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.cpu_times_user
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.cpu_times_user;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'cpu-user(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
          const dataPoint = context.raw as any;
          const iterationLabel = context.dataset.label || '';
          const timeValue = context.parsed.x.toFixed(2);
          const cpuValue = context.parsed.y.toFixed(3);

          // Check if this is an event marker
          if (dataPoint && dataPoint.eventName) {
            return [
            `Event: ${dataPoint.eventName}`,
            `Subject: ${dataPoint.eventSubject}`,
            `Time: ${dataPoint.eventTimestamp}`,
            `Elapsed: ${timeValue}s`,
            `CPU User: ${cpuValue}s`
            ];
          } else {
            return `${iterationLabel}: ${cpuValue}s CPU User at ${timeValue}s elapsed`;
          }
          }
        }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'cpu-user [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('cpu-user', new Chart(ctx, config), true));
  }

  createCPUSystemChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-cpu-system-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.cpu_times_system
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.cpu_times_system;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'cpu-system(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
          const dataPoint = context.raw as any;
          const iterationLabel = context.dataset.label || '';
          const timeValue = context.parsed.x.toFixed(2);
          const cpuValue = context.parsed.y.toFixed(3);

          // Check if this is an event marker
          if (dataPoint && dataPoint.eventName) {
            return [
            `Event: ${dataPoint.eventName}`,
            `Subject: ${dataPoint.eventSubject}`,
            `Time: ${dataPoint.eventTimestamp}`,
            `Elapsed: ${timeValue}s`,
            `CPU System: ${cpuValue}s`
            ];
          } else {
            return `${iterationLabel}: ${cpuValue}s CPU System at ${timeValue}s elapsed`;
          }
          }
        }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'cpu-system [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('cpu-system', new Chart(ctx, config), true));
  }

  createCPUPercentChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-cpu-percent-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.cpu_percent
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.cpu_percent;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'cpu(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
          const dataPoint = context.raw as any;
          const iterationLabel = context.dataset.label || '';
          const timeValue = context.parsed.x.toFixed(2);
          const cpuValue = context.parsed.y.toFixed(3);

          // Check if this is an event marker
          if (dataPoint && dataPoint.eventName) {
            return [
            `Event: ${dataPoint.eventName}`,
            `Subject: ${dataPoint.eventSubject}`,
            `Time: ${dataPoint.eventTimestamp}`,
            `Elapsed: ${timeValue}s`,
            `CPU: ${cpuValue}%`
            ];
          } else {
            return `${iterationLabel}: ${cpuValue}% CPU at ${timeValue}s elapsed`;
          }
          }
        }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'cpu [%]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('cpu-percent', new Chart(ctx, config), true));
  }

  createRAMChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-ram-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    const megabyte = 1024 * 1024;
    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.memory_rss / megabyte
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.memory_rss / megabyte;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'ram(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
              const dataPoint = context.raw as any;
              const iterationLabel = context.dataset.label || '';
              const timeValue = context.parsed.x.toFixed(2);
              const cpuValue = context.parsed.y.toFixed(3);

              // Check if this is an event marker
              if (dataPoint && dataPoint.eventName) {
                return [
                `Event: ${dataPoint.eventName}`,
                `Subject: ${dataPoint.eventSubject}`,
                `Time: ${dataPoint.eventTimestamp}`,
                `Elapsed: ${timeValue}s`,
                `RAM: ${cpuValue}MB`
                ];
              } else {
                return `${iterationLabel}: ${cpuValue}MB RAM at ${timeValue}s elapsed`;
              }
            }
          }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'ram [MB]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('cpu-percent', new Chart(ctx, config), true));
  }

  createIOWriteChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-io-write-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    const megabyte = 1024 * 1024;
    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.io_write_bytes / megabyte
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.io_write_bytes / megabyte;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'io-write(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
              const dataPoint = context.raw as any;
              const iterationLabel = context.dataset.label || '';
              const timeValue = context.parsed.x.toFixed(2);
              const cpuValue = context.parsed.y.toFixed(3);

              // Check if this is an event marker
              if (dataPoint && dataPoint.eventName) {
                return [
                `Event: ${dataPoint.eventName}`,
                `Subject: ${dataPoint.eventSubject}`,
                `Time: ${dataPoint.eventTimestamp}`,
                `Elapsed: ${timeValue}s`,
                `I/O Write: ${cpuValue}MB`
                ];
              } else {
                return `${iterationLabel}: ${cpuValue}MB I/O Write at ${timeValue}s elapsed`;
              }
            }
          }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'io-write [MB]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('io-write', new Chart(ctx, config), true));
  }

  createIOReadChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-io-read-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    const megabyte = 1024 * 1024;
    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.io_read_bytes / megabyte
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.memory_rss / megabyte;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'io-read(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
              const dataPoint = context.raw as any;
              const iterationLabel = context.dataset.label || '';
              const timeValue = context.parsed.x.toFixed(2);
              const cpuValue = context.parsed.y.toFixed(3);

              // Check if this is an event marker
              if (dataPoint && dataPoint.eventName) {
                return [
                `Event: ${dataPoint.eventName}`,
                `Subject: ${dataPoint.eventSubject}`,
                `Time: ${dataPoint.eventTimestamp}`,
                `Elapsed: ${timeValue}s`,
                `I/O Read: ${cpuValue}MB`
                ];
              } else {
                return `${iterationLabel}: ${cpuValue}MB I/O Read at ${timeValue}s elapsed`;
              }
            }
          }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'io-read [MB]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('io-read', new Chart(ctx, config), true));
  }

  createNetworkSentChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-network-sent-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    const megabyte = 1024 * 1024;
    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.network_bytes_sent / megabyte
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.network_bytes_sent / megabyte;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'network-sent(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
              const dataPoint = context.raw as any;
              const iterationLabel = context.dataset.label || '';
              const timeValue = context.parsed.x.toFixed(2);
              const cpuValue = context.parsed.y.toFixed(3);

              // Check if this is an event marker
              if (dataPoint && dataPoint.eventName) {
                return [
                `Event: ${dataPoint.eventName}`,
                `Subject: ${dataPoint.eventSubject}`,
                `Time: ${dataPoint.eventTimestamp}`,
                `Elapsed: ${timeValue}s`,
                `Network Sent: ${cpuValue}MB`
                ];
              } else {
                return `${iterationLabel}: ${cpuValue}MB Network Sent at ${timeValue}s elapsed`;
              }
            }
          }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'network-sent [MB]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('network-sent', new Chart(ctx, config), true));
  }

  createNetworkRecvChart(row: BenchmarksResultDescriptionRow) {
    const measurements = row.baseMeasurements;

    const ctx = document.getElementById('canvas-network-recv-' + row.result.Id) as HTMLCanvasElement | null;
    if (!ctx) {
      console.error('No canvas element found for chart creation - neither ViewChild nor DOM query worked - ' + row.result.Id);
      return;
    }

    if (!measurements || !measurements.iterations || measurements.iterations.length === 0) {
      console.error('No measurements data available for CPU chart');
      return;
    }

    // Generate colors for each iteration
    const colors = this.generateColors(measurements.iterations.length);

    const megabyte = 1024 * 1024;
    // Create datasets for each iteration
    const datasets = measurements.iterations.map((iteration, iterIndex) => {
      const data = iteration.metrics_detailed.map(metric => ({
        x: metric.elapsed_time,
        y: metric.process.network_bytes_recv / megabyte
      }));

      return {
        label: `Iteration ${iteration.id}`,
        data: data,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex] + '20', // Add transparency
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,        // Hide points for line data
        pointHoverRadius: 0    // Hide points on hover for line data
      };
    });

    // Create event markers datasets for each iteration
    const eventDatasets = measurements.iterations.map((iteration, iterIndex) => {
      // Convert event timestamps to elapsed time and get corresponding CPU values
      const eventData = iteration.events.map(event => {
        // Parse the event timestamp and convert to elapsed time
        const eventTimestamp = new Date(event.timestamp).getTime() / 1000;
        const startTimestamp = new Date(iteration.metrics_summary.summary.start_time).getTime() / 1000;
        const elapsedTime = eventTimestamp - startTimestamp;

        // Find the closest metric data point to interpolate CPU value
        let cpuValue = 0;
        if (iteration.metrics_detailed.length > 0) {
          const closestMetric = iteration.metrics_detailed.reduce((closest, current) => {
            return Math.abs(current.elapsed_time - elapsedTime) < Math.abs(closest.elapsed_time - elapsedTime)
              ? current : closest;
          });
          cpuValue = closestMetric.process.network_bytes_recv / megabyte;
        }

        return {
          x: elapsedTime,
          y: cpuValue,
          eventName: event.name,
          eventSubject: event.subject,
          eventTimestamp: event.timestamp
        };
      }).filter(point => point.x >= 0); // Only include events that occurred after start

      return {
        label: `Events - Iteration ${iteration.id}`,
        data: eventData,
        borderColor: colors[iterIndex],
        backgroundColor: colors[iterIndex],
        borderWidth: 3,
        fill: false,
        showLine: false, // Only show points, no connecting lines
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'circle',
        pointBorderWidth: 2,
        pointBorderColor: '#ffffff'
      };
    }).filter(dataset => dataset.data.length > 0); // Only include iterations that have events

    // Combine line datasets and event datasets
    const allDatasets = [...datasets, ...eventDatasets];

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
      datasets: allDatasets
      },
      options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
        display: true,
        text: 'network-recv(t)'
        },
        legend: {
        display: false,
        position: 'top'
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
              const dataPoint = context.raw as any;
              const iterationLabel = context.dataset.label || '';
              const timeValue = context.parsed.x.toFixed(2);
              const cpuValue = context.parsed.y.toFixed(3);

              // Check if this is an event marker
              if (dataPoint && dataPoint.eventName) {
                return [
                `Event: ${dataPoint.eventName}`,
                `Subject: ${dataPoint.eventSubject}`,
                `Time: ${dataPoint.eventTimestamp}`,
                `Elapsed: ${timeValue}s`,
                `Network Receive: ${cpuValue}MB`
                ];
              } else {
                return `${iterationLabel}: ${cpuValue}MB Network Receive at ${timeValue}s elapsed`;
              }
            }
          }
        }
      },
      scales: {
        x: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 't [s]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        },
        y: {
        type: 'linear',
        display: true,
        title: {
          display: true,
          text: 'network-recv [MB]'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
        }
      },
      elements: {
        point: {
        radius: 0,
        hoverRadius: 0
        }
      }
      }
    };

    row.charts.push(new ChartControl('network-recv', new Chart(ctx, config), true));
  }

  toggleCpuChartLegendDropdown() {
    this.cpuChartLegendDropdownOpen = !this.cpuChartLegendDropdownOpen;
  }

  toggleCpuChartDataset(row: BenchmarksResultDescriptionRow, datasetKey: string) {
    if (row.charts.length === 0) return;

    const datasetIndex = parseInt(datasetKey.replace('dataset_', ''));
    const dataset = row.charts[0].chart.data.datasets?.[datasetIndex];

    if (dataset) {
      dataset.hidden = !dataset.hidden;

      row.charts.forEach(chart => {
        if (chart instanceof ChartControl) {
          chart.chartDatasetVisibility[datasetKey] = !dataset.hidden;
          chart.chart.update();
        }
      });
    }
  }

  getCpuChartDatasetLabel(row: BenchmarksResultDescriptionRow, datasetKey: string): string {
    if (row.charts.length === 0) return '';

    const datasetIndex = parseInt(datasetKey.replace('dataset_', ''));
    const dataset = row.charts[0].chart.data.datasets?.[datasetIndex];

    return dataset?.label || `Dataset ${datasetIndex + 1}`;
  }

  getCpuChartDatasetKeys(row: BenchmarksResultDescriptionRow): string[] {
    if (row.charts.length === 0) return [];

    return Object.keys(row.charts[0].chartDatasetVisibility);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.cpu-chart-legend-dropdown');
    const button = target.closest('.cpu-chart-legend-button');

    if (!dropdown && !button && this.cpuChartLegendDropdownOpen) {
      this.cpuChartLegendDropdownOpen = false;
    }
  }

  private generateColors(count: number): string[] {
    const colors = [
      '#2196f3', // Blue
      '#ff9800', // Orange
      '#4caf50', // Green
      '#f44336', // Red
      '#9c27b0', // Purple
      '#00bcd4', // Cyan
      '#ff5722', // Deep Orange
      '#795548', // Brown
      '#607d8b', // Blue Grey
      '#e91e63'  // Pink
    ];

    // If we need more colors than predefined, generate them
    if (count > colors.length) {
      for (let i = colors.length; i < count; i++) {
        const hue = (i * 137.508) % 360; // Golden angle approximation for good distribution
        colors.push(`hsl(${hue}, 70%, 50%)`);
      }
    }

    return colors.slice(0, count);
  }

  createStatusChart(benchmarksRunDetails: BenchmarksRunDetailsDescription, canvasId?: string): Chart | null {
    if (!benchmarksRunDetails) {
      console.log('No benchmarks run details available for chart creation.');
      return null;
    }

    console.log('Attempting to create chart');

    // Use either provided canvasId or default selector
    const selector = canvasId ? `#${canvasId}` : '#main-results-chart';
    const ctx = document.querySelector(selector) as HTMLCanvasElement;
    if (!ctx) {
      console.error(`No canvas element found for chart creation with selector: ${selector}`);
      return null;
    }

    console.log('Creating status chart with canvas, data:', benchmarksRunDetails);
    return this.createChartWithContext(ctx, benchmarksRunDetails);
  }

  private createChartWithContext(ctx: HTMLCanvasElement, benchmarksRunDetails: BenchmarksRunDetailsDescription): Chart {
    const testCounts = [
      benchmarksRunDetails.CompletedBenchmarks,
      benchmarksRunDetails.RunningBenchmarks,
      benchmarksRunDetails.QueuedBenchmarks,
      0
    ];

    const data = {
      labels: [
        `Completed (${benchmarksRunDetails.CompletedBenchmarks})`,
        `Running (${benchmarksRunDetails.RunningBenchmarks})`,
        `Queued (${benchmarksRunDetails.QueuedBenchmarks})`,
        `Total (${benchmarksRunDetails.CompletedBenchmarks + benchmarksRunDetails.RunningBenchmarks + benchmarksRunDetails.QueuedBenchmarks})`
      ],
      datasets: [{
        data: testCounts,
        backgroundColor: [
          '#2196f3',  // Blue for completed
          '#ff9800',  // Orange for running
          '#9e9e9e',  // Grey for queued
          '#ffffff00'   // Transparent for total
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

    const chart = new Chart(ctx, config);

    // Store the main status chart reference for cleanup
    if (!this.statusChart) {
      this.statusChart = chart;
    }

    return chart;
  }

  // Method to create multiple results charts dynamically
  createMultipleResultsCharts(chartConfigs: Array<{id: string, data: BenchmarksRunDetailsDescription}>): void {
    chartConfigs.forEach(config => {
      setTimeout(() => {
        const chart = this.createStatusChart(config.data, config.id);
        if (chart) {
          this.resultCharts.set(config.id, chart);
        }
      }, 0);
    });
  }

  // Method to destroy a specific results chart
  destroyResultsChart(chartId: string): void {
    const chart = this.resultCharts.get(chartId);
    if (chart) {
      chart.destroy();
      this.resultCharts.delete(chartId);
    }
  }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
  const tableRows = document.querySelectorAll('#benchmarksRunResultsTable tbody tr#result');
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
  document.querySelectorAll('#benchmarksRunResultsTable .column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

  const activeSortSvg = document.querySelector(`#benchmarksRunResultsTable [data-sort="${activeColumn}"] svg`);
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

  private buildIterationOptions(row: BenchmarksResultDescriptionRow): number[] {
    const len = row.baseMeasurements?.iterations?.length ?? 0;
    const numeric = Array.from({ length: (len - 1) + 1 }, (_, i) => i); // 0..len
    return numeric;
  }

  private updateIterationOptions(row: BenchmarksResultDescriptionRow): void {
    row.iterationOptions = this.buildIterationOptions(row);
    if (!row.iterationOptions.includes(row.selectedIteration)) {
      row.selectedIteration = 0;
    }
  }

  toggleBenchmarkSteps(row: BenchmarksResultDescriptionRow) {
    row.showSteps = !row.showSteps;
  }

  changeProfileView(): void {
    // reset all columns to hidden
    Object.keys(this.metricsColumnsVisibility).forEach(col => {
      this.metricsColumnsVisibility[col] = false;
    });

    let toShow: string[] = [];
    switch (this.selectedProfileView) {
      case 'cpu':
        toShow = [
          'cpu_efficiency',
          'cpu_avg_percent',
          'cpu_max_percent',
          'cpu_min_percent',
          'cpu_total_time',
          'cpu_total_system_time',
          'cpu_total_user_time'
        ];
        break;

      case 'memory-io-network':
        toShow = [
          'mem_avg_percent',
          'mem_avg_rss_mb',
          'mem_max_percent',
          'mem_max_rss_mb',
          'io_total_read_mb',
          'io_total_write_mb',
          'net_avg_connections',
          'net_max_connections',
          'net_total_recv_mb',
          'net_total_sent_mb'
        ];
        break;

      case 'process':
        toShow = [
          'proc_avg_connections',
          'proc_avg_fd_handles',
          'proc_avg_threads',
          'proc_fd_handle_type',
          'proc_max_connections',
          'proc_max_fd_handles',
          'proc_max_threads',
          'proc_total_context_switches'
        ];
        break;

      case 'general':
      default:
        toShow = [
          'cpu_total_time',
          'mem_avg_rss_mb',
          'mem_max_rss_mb',
          'io_total_read_mb',
          'io_total_write_mb',
          'net_avg_connections',
          'net_max_connections',
          'net_total_recv_mb',
          'net_total_sent_mb'
        ]
        break;
    }

    toShow.forEach(col => {
      if (col in this.metricsColumnsVisibility) {
        this.metricsColumnsVisibility[col] = true;
      }
    });
    this.rerenderTableStructure();
    // Re-render rows so any style logic depending on column schema is refreshed after structure changes
    setTimeout(() => this.renderAllRows(), 0);
  }

  private rerenderTableStructure(): void {
    // Trigger change detection so *ngIf-bound <th>/<td>/<tr> elements appear/disappear
    this.cdr.detectChanges();
  }

  getArtifactNames(artifacts: Artifact[]): string {
    return artifacts.map(artifact => artifact.BuildName).join(', ');
  }
}
