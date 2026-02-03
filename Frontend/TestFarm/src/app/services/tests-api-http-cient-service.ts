import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { TestsRunDescription } from 'src/app/models/tests-run-description';
import { TestsRunResultDescription } from 'src/app/models/tests-run-result-description';
import { environment } from 'src/environments/environment';
import { TestHistoryResult } from 'src/app/models/test-history-result.description';
import { TestsRunResultDiffDescription } from '../models/tests-run-result-diff-description';
import { TestsRunDetailsDescription } from '../models/tests-run-details-description';
import { TestStatisticsResponse } from '../models/test-statistics';

@Injectable({
    providedIn: 'root'
  })
export class TestsApiHttpClientService {
    constructor(private http: HttpClient) { }

    getTestsRunDetails(testsRunId: string): Observable<TestsRunDetailsDescription> {
        return this.http.get<TestsRunDetailsDescription>(`${environment.baseApiUrl}/tests-run-details/${testsRunId}`);
    }

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

    getDiff(testResultDiffId: number) {
        return this.http.get<TestsRunResultDiffDescription>(`${environment.baseApiUrl}/diff/${testResultDiffId}`);
    }

    cancelTestsRun(testsRunId: string) {
        return this.http.get<{ message: string }>(`${environment.baseApiUrl}/cancel-tests-run/${testsRunId}`);
    }

    getTestStatistics(testId: number): Observable<TestStatisticsResponse> {
        return this.http.get<TestStatisticsResponse>(`${environment.baseApiUrl}/test/${testId}/statistics`);
    }
}
