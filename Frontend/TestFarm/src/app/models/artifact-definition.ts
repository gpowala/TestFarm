export interface ArtifactDefinitionLatestBuild {
  Id: number;
  BuildId: number;
  BuildName: string;
  Repository: string;
  Branch: string;
  Revision: string;
  BuildPageUrl: string;
  CreationTimestamp: string;
}

export class ArtifactDefinition {
  Id: number;
  Name: string;
  InstallScript: string;
  Tags: string[];
  LatestBuild?: ArtifactDefinitionLatestBuild;

  constructor(id: number, name: string, installScript: string, tags: string[] = [], latestBuild?: ArtifactDefinitionLatestBuild) {
    this.Id = id;
    this.Name = name;
    this.InstallScript = installScript;
    this.Tags = tags;
    this.LatestBuild = latestBuild;
  }
}
