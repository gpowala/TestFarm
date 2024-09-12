import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestsRunResultDescription } from '../../models/tests-run-result-description';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';

@Component({
  selector: 'app-tests-run-results',
  templateUrl: './tests-run-results.component.html',
  styleUrls: ['./tests-run-results.component.css']
})
export class TestsRunResultsComponent implements OnInit {
  testsRunId: string | null = null;
  testsRunResults: TestsRunResultDescription[] = [];

  constructor(private route: ActivatedRoute, private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.testsRunId = this.route.snapshot.paramMap.get('testsRunId');
    this.fetchTestsRunResultsData();
    this.testsRunResults = this.testsRunResults.map(result => ({
      ...result,
      ShowDetails: false,
      ShowHistory: false
    }));
  }

  private fetchTestsRunResultsData() {
    if (this.testsRunId) {
      this.testsApiHttpClientService.getAllTestsRunResultsData(this.testsRunId).subscribe(
        (data: TestsRunResultDescription[]) => {
          this.testsRunResults = data;
        },
        (error: any) => {
          console.error('Error fetching tests run results data:', error);
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
