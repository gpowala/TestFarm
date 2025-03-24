import * as pako from 'pako';

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

  showReport(report?: string) {
    if (report && report.length > 0) {
      try {
        // Decode base64
        const decodedReport = atob(report);

        // Convert the decoded string to a Uint8Array
        const binaryString = atob(report);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Decompress the zipped content using pako
        const decompressedReport = pako.ungzip(bytes, { to: 'string' });

        // Determine the content type (assuming HTML or plain text)
        const isHtml = decompressedReport.trim().startsWith('<');
        const mimeType = isHtml ? 'text/html' : 'text/plain';

        // Create a blob from the decompressed report
        const blob = new Blob([decompressedReport], { type: mimeType });

        // Create a URL for the blob
        const url = URL.createObjectURL(blob);

        // Open the URL in a new window
        window.open(url, '_blank');

        // Clean up by revoking the object URL after a delay
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (error) {
        console.error('Error processing report:', error);
      }
    }
  }
}
