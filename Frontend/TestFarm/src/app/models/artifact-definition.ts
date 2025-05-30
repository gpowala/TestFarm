export class ArtifactDefinition {
  Id: number;
  Name: string;
  InstallScript: string;
  Tags: string[];

  constructor(id: number, name: string, installScript: string, tags: string[] = []) {
    this.Id = id;
    this.Name = name;
    this.InstallScript = installScript;
    this.Tags = tags;
  }
}
