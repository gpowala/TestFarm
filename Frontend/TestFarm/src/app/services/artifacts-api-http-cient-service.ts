import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment ';
import { ArtifactDefinition } from '../models/artifact-definition';
import { Artifact } from '../models/artifact';

@Injectable({
    providedIn: 'root'
  })
export class ArtifactsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllArtifactsDefinitions() {
      return this.http.get<ArtifactDefinition[]>(`${environment.baseApiUrl}/artifacts-definitions`);
    }

    getArtifactDefinitionById(id: number) {
      return this.http.get<ArtifactDefinition>(`${environment.baseApiUrl}/artifact-definition`, {
        params: {
          id: id
        }
      });
    }

    addArtifactDefinition(name: string, installScript: string, tags: string[]) {
      return this.http.post<ArtifactDefinition>(`${environment.baseApiUrl}/artifact-definition`, {
        Name: name,
        InstallScript: installScript,
        Tags: tags
      });
    }

    updateArtifactDefinition(id: number, name: string, installScript: string, tags: string[]) {
      return this.http.put<ArtifactDefinition>(`${environment.baseApiUrl}/artifact-definition`, {
        Name: name,
        InstallScript: installScript,
        Tags: tags
      }, {
        params: {
          id: id
        }
      });
    }

    removeArtifactDefinition(artifactId: number) {
      return this.http.delete(`${environment.baseApiUrl}/artifact-definition`, {
        params: {
          id: artifactId
        }
      });
    }

    getArtifactsByDefinitionId(definitionId: number) {
      return this.http.get<Artifact[]>(`${environment.baseApiUrl}/artifacts-by-definition-id`, {
        params: {
          id: definitionId
        }
      });
    }
}
