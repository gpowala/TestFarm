import { Artifact } from "./artifact";
import { TestsRunResultDiffShallowDescription } from "./tests-run-result-diff-shallow-description";

export interface TestInfo {
    id: number;
    name: string;
    path: string;
    repositoryName: string;
    suiteName: string;
    owner: string;
    type: string;
}

export interface TestRunInfo {
    id: number;
    name: string;
    gridName: string;
    repositoryName: string;
    suiteName: string;
    overallStatus: string;
    timestamp: string;
}

export interface DiffStatistics {
    total: number;
    passing: number;
    failing: number;
    passingPercentage: number;
}

export interface TestStatisticsEntry {
    testResultId: number;
    testResultStatus: string;
    executionStartTimestamp: string;
    executionEndTimestamp: string;
    testRun: TestRunInfo;
    artifacts: Artifact[];
    diffStatistics: DiffStatistics;
    diffs: TestsRunResultDiffShallowDescription[];
}

export interface TestStatisticsResponse {
    test: TestInfo;
    totalRuns: number;
    statistics: TestStatisticsEntry[];
}
