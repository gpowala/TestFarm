import { Component, OnInit, Input } from '@angular/core';
import { TestHistoryResult } from '../../models/test-history-result.description';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';

@Component({
  selector: 'app-test-history',
  templateUrl: './test-history.component.html',
  styleUrls: ['./test-history.component.css']
})
export class TestHistoryComponent implements OnInit {
  @Input() testId: number | null = null;
  testHistory: TestHistoryResult[] = [];

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.fetchTestHistory();
    this.testHistory = this.testHistory.map(entry => ({
      ...entry,
      ShowDetails: false
    }));
  }

  private fetchTestHistory() {
    if (this.testId) {
      this.testsApiHttpClientService.getTestHistory(this.testId.toString()).subscribe(
        (data: TestHistoryResult[]) => {
          this.testHistory = data;
        },
        (error: any) => {
          console.error('Error fetching test history:', error);
        }
      );
    }
  }

  onMouseOver(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
  }

  onMouseOut(event: MouseEvent, detailsVisible: boolean) {
    (event.currentTarget as HTMLElement).style.backgroundColor = detailsVisible ? '#f0f0f0' : '';
  }
}
