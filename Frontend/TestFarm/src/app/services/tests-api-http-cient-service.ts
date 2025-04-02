import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { TestsRunDescription } from 'src/app/models/tests-run-description';
import { TestsRunResultDescription } from 'src/app/models/tests-run-result-description';
import { environment } from 'src/environments/environment ';
import { TestHistoryResult } from 'src/app/models/test-history-result.description';
import { TestsRunResultDiffDescription } from '../models/tests-run-result-diff-description';

@Injectable({
    providedIn: 'root'
  })
export class TestsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getAllTestsRunsData(name: string, timespan: number, result: string, limit: number) {
        return this.http.get<TestsRunDescription[]>(`${environment.baseApiUrl}/tests-runs`, {
            params: {
                name: name,
                timespan: timespan.toString(),
                result: result,
                limit: limit.toString()
            }
        });
    }

    getAllTestsRunResultsData(testsRunId: string) {
        return this.http.get<TestsRunResultDescription[]>(`${environment.baseApiUrl}/tests-run-results/${testsRunId}`);
    }

    getTestHistory(testId: string) {
        return this.http.get<TestHistoryResult[]>(`${environment.baseApiUrl}/test-history/${testId}`);
    }

    downloadTempDirArchive(testResultId: number) {
        return this.http.get(`${environment.baseApiUrl}/download-temp-dir-archive/${testResultId}`, { responseType: 'blob' });
    }
}
