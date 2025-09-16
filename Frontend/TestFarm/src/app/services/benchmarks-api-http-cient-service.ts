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
import { BenchmarkResultDescription } from '../models/benchmark-result-description';
import { BenchmarkResultDetailsDescription } from '../models/benchmark-result-details-description';
import { BenchmarksRunDescription } from '../models/benchmarks-run-description';
import { BenchmarksRunDetailsDescription } from '../models/benchmarks-run-details-description';

@Injectable({
    providedIn: 'root'
  })
export class BenchmarksApiHttpClientService {
    constructor(private http: HttpClient) { }

    getBenchmarksRunDetails(benchmarksRunId: string): Observable<BenchmarksRunDetailsDescription> {
        return this.http.get<BenchmarksRunDetailsDescription>(`${environment.baseApiUrl}/benchmarks-run-details/${benchmarksRunId}`);
    }

    getAllBenchmarksRunResults(benchmarksRunId: string): Observable<BenchmarkResultDescription[]> {
      return this.http.get<BenchmarkResultDescription[]>(`${environment.baseApiUrl}/benchmarks-run-results/${benchmarksRunId}`);
    }

    getBenchmarkResultDetails(benchmarkResultId: string): Observable<BenchmarkResultDetailsDescription> {
        return this.http.get<BenchmarkResultDetailsDescription>(`${environment.baseApiUrl}/benchmark-result-details/${benchmarkResultId}`);
    }

    getAllBenchmarksRuns(name: string, timespan: number, result: string, limit: number) {
        return this.http.get<BenchmarksRunDescription[]>(`${environment.baseApiUrl}/benchmarks-runs`, {
            params: {
                name: name,
                timespan: timespan.toString(),
                result: result,
                limit: limit.toString()
            }
        });
    }

    // getAllTestsRunResultsData(testsRunId: string) {
    //     return this.http.get<TestsRunResultDescription[]>(`${environment.baseApiUrl}/tests-run-results/${testsRunId}`);
    // }

    // getTestHistory(testId: string) {
    //     return this.http.get<TestHistoryResult[]>(`${environment.baseApiUrl}/test-history/${testId}`);
    // }

    // downloadTempDirArchive(testResultId: number) {
    //     return this.http.get(`${environment.baseApiUrl}/download-temp-dir-archive/${testResultId}`, { responseType: 'blob' });
    // }

    // getDiff(testResultDiffId: number) {
    //     return this.http.get<TestsRunResultDiffDescription>(`${environment.baseApiUrl}/diff/${testResultDiffId}`);
    // }
}
