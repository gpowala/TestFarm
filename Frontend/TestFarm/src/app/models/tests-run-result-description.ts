export interface TestsRunResultDescription {
    Id: number,
    TestId: number,
    TestName: string,
    Status: string,
    ExecutionTime: string,
    ExecutionOutput: string,

    ShowDetails?: boolean
}