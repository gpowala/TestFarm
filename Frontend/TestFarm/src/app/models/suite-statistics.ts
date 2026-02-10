export interface SuiteRunArtifact {
    id: number;
    buildId: number;
    buildName: string;
    repository: string;
    branch: string;
    revision: string;
}

export interface SuiteTestStatistics {
    total: number;
    passed: number;
    failed: number;
    queued: number;
    running: number;
    passedPercentage: number;
}

export interface SuiteDiffStatistics {
    total: number;
    passing: number;
    failing: number;
    passingPercentage: number | null;
}

export interface SuiteTestRunInfo {
    id: number;
    name: string;
    gridName: string;
    overallStatus: string;
    timestamp: string;
}

export interface SuiteStatisticsEntry {
    testRun: SuiteTestRunInfo;
    artifacts: SuiteRunArtifact[];
    testStatistics: SuiteTestStatistics;
    diffStatistics: SuiteDiffStatistics;
}

export interface SuiteStatisticsResponse {
    repositoryName: string;
    suiteName: string;
    totalRuns: number;
    statistics: SuiteStatisticsEntry[];
}
