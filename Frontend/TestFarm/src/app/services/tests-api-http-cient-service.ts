import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { TestsRunDescription } from '../models/tests-run-description';
import { TestsRunResultDescription } from '../models/tests-run-result-description';

@Injectable({
    providedIn: 'root'
  })
export class TestsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllTestsRunsData() {
        return this.http.get<TestsRunDescription[]>('http://localhost:3000/tests-runs');
    }

    getAllTestsRunResultsData(testsRunId: string) {
        return this.http.get<TestsRunResultDescription[]>('http://localhost:3000/tests-run-results/' + testsRunId);
    }
}