// Interfaces describing the structure of combined_benchmark_data.json

export interface ProcessedCombinedMetrics {
  step_index: number;       // -1 for overall
  step_name: string;        // e.g. "step-0" or "overall"
  metrics: ProcessedMetricsSummary;
}

export interface ProcessedMetricsSummary {
  summary: BenchmarkSummaryCore;
  cpu: CpuSummary;
  memory: MemorySummary;
  io: IOSummary;
  network: NetworkSummary;
  process_info: ProcessInfoSummary;
}

/**
 * Build per-step summaries across all iterations and also an overall summary.
 * Returns an array of CombinedEventMetrics (each step plus an overall entry with step_index = -1).
 */
export function calculateCombinedStepsMetrics(data: BenchmarkResultMeasurements): ProcessedCombinedMetrics[] {
  const MB = 1024 * 1024;

  const toEpoch = (ts: string) => {
    const d = new Date(ts);
    return d.getTime() / 1000;
  };

  const numAvg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);
  const numMax = (arr: number[]) => (arr.length === 0 ? 0 : Math.max(...arr));
  const numMin = (arr: number[]) => (arr.length === 0 ? 0 : Math.min(...arr));

  // Collect samples per step index across all iterations
  const perStepSamples: BenchmarkDetailedMetric[][] = [];

  for (const iter of data.iterations || []) {
    if (!iter.events || iter.events.length < 2) {
      continue;
    }
    const evEpochs = iter.events.map(e => toEpoch(e.timestamp));
    for (let si = 0; si < iter.events.length - 1; si++) {
      const start = evEpochs[si];
      const end = evEpochs[si + 1];
      const samplesForStep = (iter.metrics_detailed || []).filter(s => s.timestamp >= start && s.timestamp < end);
      if (!perStepSamples[si]) perStepSamples[si] = [];
      perStepSamples[si].push(...samplesForStep);
    }
  }

  const buildSummaryFromSamples = (samples: BenchmarkDetailedMetric[], stepIndex?: number, stepName?: string): BenchmarkMetricsSummary => {
    const procCpu = samples.map(s => s.process.cpu_percent);
    const cpuUser = samples.map(s => s.process.cpu_times_user);
    const cpuSys = samples.map(s => s.process.cpu_times_system);
    const cpuTotal = samples.map(s => s.process.cpu_times_total);

    const memRss = samples.map(s => s.process.memory_rss);
    const memPct = samples.map(s => s.process.memory_percent);

    const ioRead = samples.map(s => s.process.io_read_bytes);
    const ioWrite = samples.map(s => s.process.io_write_bytes);

    const netSent = samples.map(s => s.process.network_bytes_sent);
    const netRecv = samples.map(s => s.process.network_bytes_recv);

    const threads = samples.map(s => s.process.num_threads);
    const fdHandles = samples.map(s => s.process.fd_handle_count);
    const connections = samples.map(s => s.process.network_connections);

    const ctxSwitches = samples.map(s => (s.process.context_switches ? (s.process.context_switches.voluntary + s.process.context_switches.involuntary) : 0));

    const timestamps = samples.map(s => s.timestamp).sort((a, b) => a - b);

    const startTime = timestamps.length ? new Date(timestamps[0] * 1000).toISOString() : '';
    const endTime = timestamps.length ? new Date(timestamps[timestamps.length - 1] * 1000).toISOString() : '';
    const duration_seconds = timestamps.length ? (timestamps[timestamps.length - 1] - timestamps[0]) : 0;

    const cpuSummary: CpuSummary = {
      max_percent: numMax(procCpu),
      avg_percent: numAvg(procCpu),
      min_percent: numMin(procCpu),
      total_user_time: cpuUser.reduce((a, b) => a + b, 0),
      total_system_time: cpuSys.reduce((a, b) => a + b, 0),
      total_cpu_time: cpuTotal.reduce((a, b) => a + b, 0),
      cpu_efficiency: numAvg(procCpu)
    };

    const memorySummary: MemorySummary = {
      max_rss_bytes: numMax(memRss),
      max_rss_mb: Math.round(numMax(memRss) / MB),
      avg_rss_bytes: Math.round(numAvg(memRss)),
      avg_rss_mb: Math.round(numAvg(memRss) / MB),
      max_percent: numMax(memPct),
      avg_percent: numAvg(memPct)
    };

    const ioSummary: IOSummary = {
      total_read_bytes: ioRead.reduce((a, b) => a + b, 0),
      total_write_bytes: ioWrite.reduce((a, b) => a + b, 0),
      total_read_mb: Math.round(ioRead.reduce((a, b) => a + b, 0) / MB),
      total_write_mb: Math.round(ioWrite.reduce((a, b) => a + b, 0) / MB)
    };

    const networkSummary: NetworkSummary = {
      total_bytes_sent: netSent.reduce((a, b) => a + b, 0),
      total_bytes_recv: netRecv.reduce((a, b) => a + b, 0),
      total_sent_mb: Math.round(netSent.reduce((a, b) => a + b, 0) / MB),
      total_recv_mb: Math.round(netRecv.reduce((a, b) => a + b, 0) / MB),
      max_connections: numMax(connections),
      avg_connections: numAvg(connections)
    };

    const processInfoSummary: ProcessInfoSummary = {
      max_threads: numMax(threads),
      avg_threads: numAvg(threads),
      max_fd_handles: numMax(fdHandles),
      avg_fd_handles: numAvg(fdHandles),
      fd_handle_type: samples.length ? (samples[0].process.fd_handle_type || '') : '',
      max_connections: numMax(connections),
      avg_connections: numAvg(connections),
      total_context_switches: ctxSwitches.reduce((a, b) => a + b, 0)
    };

    const summaryCore: BenchmarkSummaryCore = {
      command: stepName || `step-${stepIndex ?? 0}`,
      start_time: startTime,
      end_time: endTime,
      stdout: '',
      stderr: '',
      exit_code: 0,
      duration_seconds,
      samples_collected: samples.length,
      monitoring_interval: 0,
      operating_system: {
        system: '',
        release: '',
        version: '',
        machine: '',
        processor: '',
        cpu_count_logical: 0,
        cpu_count_physical: 0
      }
    };

    return {
      summary: summaryCore,
      cpu: cpuSummary,
      memory: memorySummary,
      io: ioSummary,
      network: networkSummary,
      process_info: processInfoSummary
    };
  };

  const combined: ProcessedCombinedMetrics[] = perStepSamples.map((samples, idx) => ({
    step_index: idx,
    step_name: data.iterations[0].events[idx]?.name || `unknown-step-${idx}`,
    metrics: buildSummaryFromSamples(samples || [], idx, `unknown-step-${idx}`)
  }));

  const allSamples = ([] as BenchmarkDetailedMetric[]).concat(...perStepSamples);
  const overall = buildSummaryFromSamples(allSamples, -1, 'overall');
  combined.push({ step_index: -1, step_name: 'overall', metrics: overall });

  return combined;
}

export interface BenchmarkResultMeasurements {
	iterations: BenchmarkIteration[];
}

export interface BenchmarkIteration {
	id: number;
	events: BenchmarkEvent[];
	metrics_summary: BenchmarkMetricsSummary;
	metrics_detailed: BenchmarkDetailedMetric[];
}

export interface BenchmarkEvent {
	timestamp: string; // e.g. "2025-08-06 11:10:01.884"
	subject: string;   // e.g. "Automatic", "PayrollClosure"
	name: string;      // e.g. "Initialization", "Start control"
}

// Summary section ------------------------------------------------------------
export interface BenchmarkMetricsSummary {
	summary: BenchmarkSummaryCore;
	cpu: CpuSummary;
	memory: MemorySummary;
	io: IOSummary;
	network: NetworkSummary;
	process_info: ProcessInfoSummary;
}

export interface BenchmarkSummaryCore {
	command: string;
	start_time: string;        // ISO timestamp
	end_time: string;          // ISO timestamp
	stdout: string;
	stderr: string;
	exit_code: number;
	duration_seconds: number;  // total wall clock seconds
	samples_collected: number;
	monitoring_interval: number; // seconds
	operating_system: OperatingSystemInfo;
}

export interface OperatingSystemInfo {
	system: string;     // e.g. "Windows"
	release: string;    // e.g. "2022Server"
	version: string;    // build version
	machine: string;    // architecture (e.g. AMD64)
	processor: string;  // full CPU descriptor
	cpu_count_logical: number;
	cpu_count_physical: number;
}

export interface CpuSummary {
	max_percent: number;
	avg_percent: number;
	min_percent: number;
	total_user_time: number;   // seconds
	total_system_time: number; // seconds
	total_cpu_time: number;    // seconds
	cpu_efficiency: number;    // custom metric (percentage)
}

export interface MemorySummary {
	max_rss_bytes: number;
	max_rss_mb: number;
	avg_rss_bytes: number;
	avg_rss_mb: number;
	max_percent: number; // of total system memory
	avg_percent: number; // of total system memory
}

export interface IOSummary {
	total_read_bytes: number;
	total_write_bytes: number;
	total_read_mb: number;
	total_write_mb: number;
}

export interface NetworkSummary {
	total_bytes_sent: number;
	total_bytes_recv: number;
	total_sent_mb: number;
	total_recv_mb: number;
	max_connections: number;
	avg_connections: number;
}

export interface ProcessInfoSummary {
	max_threads: number;
	avg_threads: number;
	max_fd_handles: number;
	avg_fd_handles: number;
	fd_handle_type: string; // e.g. "handles"
	max_connections: number;
	avg_connections: number;
	total_context_switches: number;
}

// Detailed (per-sample) metrics ---------------------------------------------
export interface BenchmarkDetailedMetric {
	timestamp: number;    // epoch (float seconds)
	elapsed_time: number; // seconds since start
	process: ProcessDetailedMetrics;
	system: SystemDetailedMetrics;
}

export interface ProcessDetailedMetrics {
	cpu_percent: number;       // normalized (0-100 * logical cores?)
	cpu_percent_raw: number;   // raw percent (may exceed 100 for multi-core aggregate)
	cpu_times_user: number;    // seconds
	cpu_times_system: number;  // seconds
	cpu_times_total: number;   // seconds
	memory_rss: number;        // resident set size bytes
	memory_vms: number;        // virtual memory size bytes
	memory_percent: number;    // percent of system memory
	num_threads: number;
	fd_handle_count: number;
	fd_handle_type: string;
	io_read_count: number;
	io_write_count: number;
	io_read_bytes: number;
	io_write_bytes: number;
	network_bytes_sent: number;
	network_bytes_recv: number;
	network_packets_sent: number;
	network_packets_recv: number;
	network_connections: number;
	context_switches: ContextSwitches;
}

export interface ContextSwitches {
	voluntary: number;
	involuntary: number;
}

export interface SystemDetailedMetrics {
	cpu_percent: number;    // overall system cpu percent
	memory_total: number;   // bytes
	memory_available: number; // bytes
	memory_used: number;    // bytes
	memory_percent: number; // percent used
}

