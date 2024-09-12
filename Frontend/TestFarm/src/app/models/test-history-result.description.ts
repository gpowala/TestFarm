export interface TestHistoryResult {
    Id: number;
    TestRunId: number;
    TestRunName: string;
    Status: string;
    ExecutionTime: string;
    ExecutionOutput: string;

    ShowDetails?: boolean
}
