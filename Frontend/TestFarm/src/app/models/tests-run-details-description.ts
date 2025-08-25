export interface TestsRunDetailsDescription {
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

  QueuedTests: number;
  RunningTests: number;
  PassedTests: number;
  FailedTests: number;
  TotalTests: number;

  TeamsNotificationUrl: string;
}
