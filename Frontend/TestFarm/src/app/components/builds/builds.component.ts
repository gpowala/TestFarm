import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';
import { AddArtifactDialogComponent } from './add-artifact-dialog/add-artifact-dialog.component';

@Component({
  selector: 'app-builds',
  templateUrl: './builds.component.html',
  styleUrls: ['./builds.component.css']
})
export class BuildsComponent implements OnInit {
  artifacts: ArtifactDefinition[] = [];
  constructor(
    private artifactsApiHttpClientService: ArtifactsApiHttpClientService,
    private dialog: MatDialog
  ) {}

  ngOnInit() {
    this.fetchArtifacts();
  }

  fetchArtifacts() {
    this.artifactsApiHttpClientService.getAllArtifactsDefinitions().subscribe(
      (data: ArtifactDefinition[]) => {
        this.artifacts = data;
      },
      (error: any) => {
        console.error('Error fetching artifacts data:', error);
      }
    );
  }
  createArtifact() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true; // Prevent closing by clicking outside
    dialogConfig.autoFocus = true;
    dialogConfig.width = '800px';

    const dialogRef = this.dialog.open(AddArtifactDialogComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.artifactsApiHttpClientService.addArtifact(
          result.Name,
          result.InstallScript,
          result.Tags
        ).subscribe(
          (data: ArtifactDefinition) => {
            this.fetchArtifacts();
            console.log('Artifact added successfully:', data);
          },
          (error: any) => {
            console.error('Error adding artifact:', error);
          }
        );
      }
    });
  }

  removeArtifact(id: number) {
    this.artifactsApiHttpClientService.removeArtifact(id).subscribe(
      () => {
        this.fetchArtifacts();
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
