import { Component, Input, OnInit } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';
import { Artifact } from 'src/app/models/artifact';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-artifacts',
  templateUrl: './artifacts.component.html',
  styleUrls: ['./artifacts.component.css']
})
export class ArtifactsComponent implements OnInit {
  artifactDefinition!: ArtifactDefinition;
  artifacts: Artifact[] = [];

  constructor(private route: ActivatedRoute, private artifactsApiHttpClientService: ArtifactsApiHttpClientService) {}
  ngOnInit() {
    let artifactDefinitionId = this.route.snapshot.paramMap.get('artifactDefinitionId');

    if (artifactDefinitionId) {
      this.loadArtifactDefinition(+artifactDefinitionId);
    }
  }
  loadArtifactDefinition(artifactDefinitionId: number) {
    this.artifactsApiHttpClientService.getArtifactDefinitionById(artifactDefinitionId).subscribe(
      (data: ArtifactDefinition) => {
        this.artifactDefinition = data;
        this.loadArtifactsFromDefinition();
      },
      (error: any) => {
        console.error('Error fetching artifact definition data:', error);
      }
    );
  }

  loadArtifactsFromDefinition() {
    this.artifactsApiHttpClientService.getArtifactsByDefinitionId(this.artifactDefinition.Id).subscribe(
      (data: Artifact[]) => {
        this.artifacts = data;
      },
      (error: any) => {
        console.error('Error fetching artifacts data:', error);
      }
    );
  }

  onMouseOver(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
  }

  onMouseOut(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '';
  }
}
