import { TestsRunResultDiffShallowDescription } from "./tests-run-result-diff-shallow-description";

export interface TestsRunResultDescription {
    Id: number,
    TestId: number,
    TestName: string,
    TestRepositoryName: string,
    TestSuiteName: string,
    TestPath: string,
    TestOwner: string,
    Status: string,
    ExecutionStartTimestamp: string,
    ExecutionEndTimestamp: string,
    ExecutionOutput: string,
    Diffs?: TestsRunResultDiffShallowDescription[],

    ShowDetails?: boolean,
    ShowDiffs?: boolean,
    ShowHistory?: boolean
}
