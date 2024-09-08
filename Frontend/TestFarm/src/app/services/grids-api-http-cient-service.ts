import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { GridDescription } from '../models/grid-description';

@Injectable({
    providedIn: 'root'
  })
export class GridsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllGridsData() {
        return this.http.get<GridDescription[]>('http://localhost:3000/grids');
    }
}