import { Component, OnInit } from '@angular/core';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';

@Component({
  selector: 'app-repositories',
  templateUrl: './repositories.component.html',
  styleUrls: ['./repositories.component.css']
})
export class RepositoriesComponent {
  repositories: RepositoryDescription[] = [];

  repositoryName: string = "";
  repositoryUrl: string = "";
  repositoryUser: string = "";
  repositoryToken: string = "";

  constructor(private repositoriesApiHttpClientService: RepositoriesApiHttpClientService) {

  }

  ngOnInit() {
    this.fetchRepositories();
  }

  fetchRepositories() {
    this.repositoriesApiHttpClientService.getAllRepositoriesData().subscribe(
      (data: RepositoryDescription[]) => {
        this.repositories = data;
      },
      (error: any) => {
        console.error('Error fetching repositories data:', error);
      }
    );
  }

  addRepository() {
    this.repositoriesApiHttpClientService.addRepository(this.repositoryName, this.repositoryUrl, this.repositoryUser, this.repositoryToken).subscribe(
      (data: RepositoryDescription) => {
        this.fetchRepositories();
        console.log(data)
      },
      (error: any) => {
        console.error('Error fetching repositories data:', error);
      }
    );
  }

  removeRepository(id: number) {
    this.repositoriesApiHttpClientService.removeRepository(id).subscribe(
      (data: ConfirmationMessageDescription) => {
        this.fetchRepositories();
        console.log(data.message)
      },
      (error: any) => {
        console.error('Error fetching repositories data:', error);
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
