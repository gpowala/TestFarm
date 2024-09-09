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

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.fetchTestsRunsData();
  }

  private fetchTestsRunsData() {
    this.testsApiHttpClientService.getAllTestsRunsData().subscribe(
      (data: TestsRunDescription[]) => {
        this.testsRuns = data;
      },
      (error: any) => {
        console.error('Error fetching tests runs data:', error);
      }
    );
  }

  onMouseOver(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
  }

  onMouseOut(event: MouseEvent) {
    (event.currentTarget as HTMLElement).style.backgroundColor = '';
  }
}
