import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';
import { AddArtifactDefinitionDialogComponent } from './add-artifact-definition-dialog/add-artifact-definition-dialog.component';
import { AddArtifactDialogComponent } from './add-artifact-dialog/add-artifact-dialog.component';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
  selector: 'app-builds',
  templateUrl: './builds.component.html',
  styleUrls: ['./builds.component.css']
})
export class BuildsComponent implements OnInit {
  artifacts: ArtifactDefinition[] = [];
  selection = new SelectionModel<number>(true, []); // Multiple selection enabled

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

  // Toggle artifact selection
  toggleSelection(artifactId: number): void {
    this.selection.toggle(artifactId);
    console.log('Selected artifact IDs:', this.selection.selected);
  }

  // Check if all artifacts are selected
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.artifacts.length;
    return numSelected === numRows && numRows > 0;
  }

  // Toggle all selections
  toggleAllSelection(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.artifacts.forEach(artifact => this.selection.select(artifact.Id));
    }
    console.log('Selected artifact IDs:', this.selection.selected);
  }

  // Get selected artifacts
  getSelectedArtifacts(): number[] {
    return this.selection.selected;
  }

  createArtifactDefinition() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true; // Prevent closing by clicking outside
    dialogConfig.autoFocus = true;
    dialogConfig.width = '800px';

    const dialogRef = this.dialog.open(AddArtifactDefinitionDialogComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.artifactsApiHttpClientService.addArtifactDefinition(
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

  addArtifact() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.disableClose = true; // Prevent closing by clicking outside
    dialogConfig.autoFocus = true;
    dialogConfig.width = '800px';

    dialogConfig.data = {
      selectedArtifact: this.artifacts.filter(artifact => this.selection.selected.includes(artifact.Id))[0]
    };

    const dialogRef = this.dialog.open(AddArtifactDialogComponent, dialogConfig);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.artifactsApiHttpClientService.addArtifact(
          result.ArtifactDefinitionId,
          result.BuildId,
          result.BuildName,
          result.Repository,
          result.Branch,
          result.Revision,
          result.WorkItemUrl,
          result.BuildPageUrl,
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
    this.artifactsApiHttpClientService.removeArtifactDefinition(id).subscribe(
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
