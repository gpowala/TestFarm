export interface BenchmarkResultDescription {
    Id: number,
    BenchmarkId: number,
    BenchmarkName: string,
    BenchmarkRepositoryName: string,
    BenchmarkSuiteName: string,
    BenchmarkPath: string,
    BenchmarkOwner: string,
    Status: string,
    ExecutionStartTimestamp: string,
    ExecutionEndTimestamp: string
}
