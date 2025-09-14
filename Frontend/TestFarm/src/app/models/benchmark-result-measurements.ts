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

  // Collect samples per step index per iteration: perStepSamples[stepIndex][iterationIndex] = BenchmarkDetailedMetric[]
  const perStepSamples: BenchmarkDetailedMetric[][][] = [];

  data.iterations?.forEach((iter, iterIndex) => {
    if (!iter.events || iter.events.length < 2) return;
    const evEpochs = iter.events.map(e => toEpoch(e.timestamp));
    for (let si = 0; si < iter.events.length - 1; si++) {
      const start = evEpochs[si];
      const end = evEpochs[si + 1];
      const samplesForStep = (iter.metrics_detailed || []).filter(s => s.timestamp >= start && s.timestamp < end);
      if (!perStepSamples[si]) perStepSamples[si] = [];
      perStepSamples[si][iterIndex] = samplesForStep;
    }
  });

  /**
   * Build a summary aggregating per-iteration statistics. Totals (cpu times, IO, network, context switches)
   * are computed as the average of per-iteration deltas (last - first sample counters) instead of summing
   * across all samples (which would grossly overcount). Duration is the average per-iteration duration.
   * Start/end are represented as the earliest start and latest end across iterations (cannot be
   * meaningfully "averaged").
   */
  const buildSummaryFromSamples = (samplesByIteration: BenchmarkDetailedMetric[][], stepIndex?: number, stepName?: string): BenchmarkMetricsSummary => {
    const flat: BenchmarkDetailedMetric[] = samplesByIteration ? samplesByIteration.flat() : [];

    const procCpu = flat.map(s => s.process.cpu_percent);
    const memRss = flat.map(s => s.process.memory_rss);
    const memPct = flat.map(s => s.process.memory_percent);
    const threads = flat.map(s => s.process.num_threads);
    const fdHandles = flat.map(s => s.process.fd_handle_count);
    const connections = flat.map(s => s.process.network_connections);

    // Helper to compute average per-iteration delta of a monotonically increasing counter
    const avgDelta = (selector: (p: ProcessDetailedMetrics) => number): number => {
      const deltas: number[] = [];
      samplesByIteration.forEach(iterSamples => {
        if (!iterSamples || iterSamples.length < 2) return; // need at least 2 to form a delta
        const first = iterSamples[0].process;
        const last = iterSamples[iterSamples.length - 1].process;
        deltas.push(selector(last) - selector(first));
      });
      return numAvg(deltas);
    };

    // Context switches (voluntary + involuntary) delta per iteration
    const avgCtxSwitchesDelta = (() => {
      const deltas: number[] = [];
      samplesByIteration.forEach(iterSamples => {
        if (!iterSamples || iterSamples.length < 2) return;
        const first = iterSamples[0].process.context_switches;
        const last = iterSamples[iterSamples.length - 1].process.context_switches;
        const firstTotal = (first?.voluntary || 0) + (first?.involuntary || 0);
        const lastTotal = (last?.voluntary || 0) + (last?.involuntary || 0);
        deltas.push(lastTotal - firstTotal);
      });
      return numAvg(deltas);
    })();

    const timestampsPerIteration = samplesByIteration.map(iterSamples => iterSamples.map(s => s.timestamp).sort((a, b) => a - b));
    const starts = timestampsPerIteration.filter(t => t.length).map(t => t[0]);
    const ends = timestampsPerIteration.filter(t => t.length).map(t => t[t.length - 1]);
    const durations = timestampsPerIteration.filter(t => t.length > 1).map(t => t[t.length - 1] - t[0]);

    const startTime = starts.length ? new Date(Math.min(...starts) * 1000).toISOString() : '';
    const endTime = ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : '';
    const duration_seconds = durations.length ? numAvg(durations) : 0;

    // If no measurable duration, zero out all numeric results for this step as requested
    if (duration_seconds === 0) {
      const zeroCpu: CpuSummary = {
        max_percent: 0,
        avg_percent: 0,
        min_percent: 0,
        total_user_time: 0,
        total_system_time: 0,
        total_cpu_time: 0,
        cpu_efficiency: 0
      };
      const zeroMem: MemorySummary = {
        max_rss_bytes: 0,
        max_rss_mb: 0,
        avg_rss_bytes: 0,
        avg_rss_mb: 0,
        max_percent: 0,
        avg_percent: 0
      };
      const zeroIO: IOSummary = {
        total_read_bytes: 0,
        total_write_bytes: 0,
        total_read_mb: 0,
        total_write_mb: 0
      };
      const zeroNet: NetworkSummary = {
        total_bytes_sent: 0,
        total_bytes_recv: 0,
        total_sent_mb: 0,
        total_recv_mb: 0,
        max_connections: 0,
        avg_connections: 0
      };
      const zeroProc: ProcessInfoSummary = {
        max_threads: 0,
        avg_threads: 0,
        max_fd_handles: 0,
        avg_fd_handles: 0,
        fd_handle_type: '',
        max_connections: 0,
        avg_connections: 0,
        total_context_switches: 0
      };
      const zeroSummary: BenchmarkSummaryCore = {
        command: stepName || `step-${stepIndex ?? 0}`,
        start_time: '',
        end_time: '',
        stdout: '',
        stderr: '',
        exit_code: 0,
        duration_seconds: 0,
        samples_collected: 0,
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
        summary: zeroSummary,
        cpu: zeroCpu,
        memory: zeroMem,
        io: zeroIO,
        network: zeroNet,
        process_info: zeroProc
      };
    }

    const cpuSummary: CpuSummary = {
      max_percent: numMax(procCpu),
      avg_percent: numAvg(procCpu),
      min_percent: numMin(procCpu),
      total_user_time: avgDelta(p => p.cpu_times_user),
      total_system_time: avgDelta(p => p.cpu_times_system),
      total_cpu_time: avgDelta(p => p.cpu_times_total),
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
      total_read_bytes: avgDelta(p => p.io_read_bytes),
      total_write_bytes: avgDelta(p => p.io_write_bytes),
      total_read_mb: Math.round(avgDelta(p => p.io_read_bytes) / MB),
      total_write_mb: Math.round(avgDelta(p => p.io_write_bytes) / MB)
    };

    const networkSummary: NetworkSummary = {
      total_bytes_sent: avgDelta(p => p.network_bytes_sent),
      total_bytes_recv: avgDelta(p => p.network_bytes_recv),
      total_sent_mb: Math.round(avgDelta(p => p.network_bytes_sent) / MB),
      total_recv_mb: Math.round(avgDelta(p => p.network_bytes_recv) / MB),
      max_connections: numMax(connections),
      avg_connections: numAvg(connections)
    };

    const processInfoSummary: ProcessInfoSummary = {
      max_threads: numMax(threads),
      avg_threads: numAvg(threads),
      max_fd_handles: numMax(fdHandles),
      avg_fd_handles: numAvg(fdHandles),
      fd_handle_type: flat.length ? (flat[0].process.fd_handle_type || '') : '',
      max_connections: numMax(connections),
      avg_connections: numAvg(connections),
      total_context_switches: avgCtxSwitchesDelta
    };

    const summaryCore: BenchmarkSummaryCore = {
      command: stepName || `step-${stepIndex ?? 0}`,
      start_time: startTime,
      end_time: endTime,
      stdout: '',
      stderr: '',
      exit_code: 0,
      duration_seconds,
      samples_collected: flat.length,
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

  const combined: ProcessedCombinedMetrics[] = perStepSamples.map((samplesByIter, idx) => ({
    step_index: idx,
    step_name: data.iterations[0]?.events[idx]?.name || `unknown-step-${idx}`,
    metrics: buildSummaryFromSamples(samplesByIter || [], idx, data.iterations[0]?.events[idx]?.name || `unknown-step-${idx}`)
  }));

  // Overall: average metrics across iterations using full metrics_detailed of each iteration
  const overallSamplesByIteration: BenchmarkDetailedMetric[][] = (data.iterations || []).map(it => it.metrics_detailed || []);
  const overall = buildSummaryFromSamples(overallSamplesByIteration, -1, 'overall');
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

