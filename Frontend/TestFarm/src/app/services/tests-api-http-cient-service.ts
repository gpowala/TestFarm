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
import { SuiteStatisticsResponse } from '../models/suite-statistics';
import { RebaselineProgressEvent } from '../models/rebaseline-progress-event';

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

    getSuiteStatistics(repositoryName: string, suiteName: string): Observable<SuiteStatisticsResponse> {
        return this.http.get<SuiteStatisticsResponse>(`${environment.baseApiUrl}/suite/statistics`, {
            params: {
                repositoryName: repositoryName,
                suiteName: suiteName
            }
        });
    }

    // Rebaseline the given failed test results and stream live progress. The backend responds with
    // newline-delimited JSON; we read the stream and emit each parsed event. HttpClient does not
    // cleanly surface incremental text, so we use fetch + ReadableStream here.
    rebaseline(testResultIds: number[], user: { Username: string; Email: string }): Observable<RebaselineProgressEvent> {
        return new Observable<RebaselineProgressEvent>(observer => {
            const controller = new AbortController();

            fetch(`${environment.baseApiUrl}/rebaseline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ TestResultIds: testResultIds, User: user }),
                signal: controller.signal
            }).then(async response => {
                if (!response.ok || !response.body) {
                    observer.error(new Error(`Rebaseline request failed (${response.status})`));
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                const emitLine = (line: string) => {
                    const trimmed = line.trim();
                    if (!trimmed) { return; }
                    try {
                        observer.next(JSON.parse(trimmed) as RebaselineProgressEvent);
                    } catch (e) {
                        console.error('Failed to parse rebaseline event:', trimmed, e);
                    }
                };

                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) { break; }
                    buffer += decoder.decode(value, { stream: true });

                    let newlineIndex: number;
                    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                        emitLine(buffer.slice(0, newlineIndex));
                        buffer = buffer.slice(newlineIndex + 1);
                    }
                }

                emitLine(buffer);
                observer.complete();
            }).catch(err => {
                if (err && err.name === 'AbortError') {
                    observer.complete();
                } else {
                    observer.error(err);
                }
            });

            return () => controller.abort();
        });
    }
}
