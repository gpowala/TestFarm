import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { GridDescription } from '../models/grid-description';
import { environment } from 'src/environments/environment ';

@Injectable({
    providedIn: 'root'
  })
export class GridsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllGridsData() {
        return this.http.get<GridDescription[]>(`${environment.baseApiUrl}/grids`);
    }
}