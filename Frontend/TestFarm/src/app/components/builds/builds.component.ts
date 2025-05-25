import { Component, OnInit } from '@angular/core';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';

@Component({
  selector: 'app-builds',
  templateUrl: './builds.component.html',
  styleUrls: ['./builds.component.css']
})
export class BuildsComponent implements OnInit {
  artifacts: ArtifactDefinition[] = [];

  constructor(private artifactsApiHttpClientService: ArtifactsApiHttpClientService) {

  }

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

  // addArtifact() {
  //   this.repositoriesApiHttpClientService.addArtifact(this.repositoryName, this.repositoryUrl, this.repositoryUser, this.repositoryToken).subscribe(
  //     (data: RepositoryDescription) => {
  //       this.fetchArtifacts();
  //       console.log(data)
  //     },
  //     (error: any) => {
  //       console.error('Error fetching artifacts data:', error);
  //     }
  //   );
  // }

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
