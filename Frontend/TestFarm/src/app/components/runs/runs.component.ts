import { Component, OnInit } from '@angular/core';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';
import { TestsRunDescription } from '../../models/tests-run-description';

@Component({
  selector: 'app-runs',
  templateUrl: './runs.component.html',
  styleUrls: ['./runs.component.css']
})
export class RunsComponent implements OnInit {
  public testsRuns: TestsRunDescription[] = [];

  public timespanPresets: { [key: string]: string } = {
    '1d': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    'all': 'All time'
  };
  public selectedTimespan: string = '7d';

  public resultPresets: { [key: string]: string } = {
    'passed': 'Passed',
    'failed': 'Failed',
    'all': 'All'
  };
  public selectedResult: string = 'all';

  public searchName: string = '';
  public fromDate: string = '';
  public toDate: string = '';
  public limit: number = 40;

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.fetchTestsRunsData();
  }

  private getTimespanInHours(timespan: string): number {
    switch (timespan) {
      case '1d':
        return 24;
      case '7d':
        return 24 * 7;
      case '30d':
        return 24 * 30;
      case 'all':
        return -1;
      default:
        return 24 * 7;
    }
  }

  fetchTestsRunsData() {
    this.testsApiHttpClientService.getAllTestsRunsData(this.searchName, this.getTimespanInHours(this.selectedTimespan), this.selectedResult, this.limit).subscribe(
      (data: TestsRunDescription[]) => {
        this.testsRuns = data;
      },
      (error: any) => {
        console.error('Error fetching tests runs data:', error);
      }
    );
  }

  increaseLimit() {
    this.limit += 20;
    this.fetchTestsRunsData();
  }

  onMouseOver(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
  }

  onMouseOut(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '';
  }
}
