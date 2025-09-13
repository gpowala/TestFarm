export interface BenchmarksRunDetailsDescription {
  Id: number;
  Name: string;
  GridName: string;
  RepositoryName: string;
  SuiteName: string;

  OverallCreationTimestamp: string;
  OverallExecutionStartTimestamp: string;
  OverallExecutionEndTimestamp: string | null;
  TotalDurationMs: number | null;

  OverallStatus: string;

  QueuedBenchmarks: number;
  RunningBenchmarks: number;
  CompletedBenchmarks: number;
  TotalBenchmarks: number;

  TeamsNotificationUrl: string;
}
