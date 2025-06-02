export interface Artifact {
  Id: number;
  ArtifactDefinitionId: number;
  BuildId: number;
  BuildName: string;
  Repository: string;
  Branch: string;
  Revision: string;
  WorkItemUrl?: string;
  BuildPageUrl?: string;
  Tags: string[];
  CreationTimestamp: Date;
}
