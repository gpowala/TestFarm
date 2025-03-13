import { TestsRunResultDiffDescription } from "./tests-run-result-diff-description";

export interface TestsRunResultDescription {
    Id: number,
    TestId: number,
    TestName: string,
    Status: string,
    ExecutionTime: string,
    ExecutionOutput: string,
    Diffs?: TestsRunResultDiffDescription[],

    ShowDetails?: boolean,
    ShowDiffs?: boolean,
    ShowHistory?: boolean
}
