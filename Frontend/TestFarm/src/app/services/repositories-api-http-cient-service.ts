import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { TestsRunDescription } from 'src/app/models/tests-run-description';
import { TestsRunResultDescription } from 'src/app/models/tests-run-result-description';
import { environment } from 'src/environments/environment ';
import { TestHistoryResult } from 'src/app/models/test-history-result.description';
import { RepositoryDescription } from '../models/repository-description';
import { ConfirmationMessageDescription } from '../models/confirmation-message-description';

@Injectable({
    providedIn: 'root'
  })
export class RepositoriesApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllRepositoriesData() {
      return this.http.get<RepositoryDescription[]>(`${environment.baseApiUrl}/repositories`);
    }

    addRepository(repositoryName: string, repositoryUrl: string, repositoryUser: string, repositoryToken: string) {
      return this.http.post<RepositoryDescription>(`${environment.baseApiUrl}/add-repository`, {
        name: repositoryName,
        url: repositoryUrl,
        user: repositoryUser,
        token: repositoryToken
      });
    }

    removeRepository(repositoryId: number) {
      return this.http.get<ConfirmationMessageDescription>(`${environment.baseApiUrl}/remove-repository`, {
        params: {
          id: repositoryId
        }
      });
    }
}
