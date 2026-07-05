export type RebaselineEventType =
  | 'run-start'
  | 'clone'
  | 'test-start'
  | 'test-passed'
  | 'test-rebaselined'
  | 'test-nothing-to-rebaseline'
  | 'diff-replaced'
  | 'commit'
  | 'push'
  | 'complete'
  | 'error';

export interface RebaselineReplacedDiff {
  diff: string;
  goldPath: string;
}

export interface RebaselineSkippedDiff {
  diff: string;
  reason: string;
}

export interface RebaselineProgressEvent {
  type: RebaselineEventType;

  // Contextual fields (present depending on event type)
  message?: string;
  repositoryName?: string;
  total?: number;

  testResultId?: number;
  testName?: string;
  testPath?: string;

  reason?: string;
  diff?: string;
  goldPath?: string;

  replacedCount?: number;
  replaced?: RebaselineReplacedDiff[];
  skipped?: RebaselineSkippedDiff[];

  committed?: boolean;
  filesChanged?: number;
}
