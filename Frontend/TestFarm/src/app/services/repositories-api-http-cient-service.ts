import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
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

    getRepositoryByName(name: string) {
      return this.http.get<RepositoryDescription[]>(`${environment.baseApiUrl}/repositories`, {
        params: { name }
      });
    }

    addRepository(name: string, url: string, user: string, token: string) {
      return this.http.post<RepositoryDescription>(`${environment.baseApiUrl}/add-repository`, {
        name,
        url,
        user,
        token
      });
    }

    updateRepository(id: number, name: string, url: string, user: string, token: string) {
      return this.http.put<RepositoryDescription>(`${environment.baseApiUrl}/update-repository`, {
        id,
        name,
        url,
        user,
        token
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
