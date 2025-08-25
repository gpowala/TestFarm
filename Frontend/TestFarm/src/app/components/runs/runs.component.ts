import { Component, OnInit } from '@angular/core';
import { TestsApiHttpClientService } from '../../services/tests-api-http-cient-service';
import { TestsRunDescription } from '../../models/tests-run-description';
import { catchError, of, tap } from 'rxjs';

class TestsRunDescriptionRow {
  active: boolean = false;
  checked: boolean = false;

  constructor(public testsRun: TestsRunDescription) {}
}

@Component({
  selector: 'app-runs',
  templateUrl: './runs.component.html',
  styleUrls: ['./runs.component.css']
})
export class RunsComponent implements OnInit {
  testsRuns: TestsRunDescription[] = [];
  testsRunsRows: TestsRunDescriptionRow[] = [];
  filteredTestsRunsRows: TestsRunDescriptionRow[] = [];
  sortDirection: { [key: string]: 'asc' | 'desc' } = {};
  searchTerm: string = '';

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
    'running': 'Running',
    'queued': 'Queued',
    'all': 'All'
  };
  public selectedResult: string = 'all';

  public searchName: string = '';
  public fromDate: string = '';
  public toDate: string = '';
  public limit: number = 40;

  constructor(private testsApiHttpClientService: TestsApiHttpClientService) {}

  ngOnInit() {
    this.fetchTestsRuns();
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

  fetchTestsRuns() {
    this.testsApiHttpClientService.getAllTestsRunsData(this.searchName, this.getTimespanInHours(this.selectedTimespan), this.selectedResult, this.limit).pipe(
      tap({
        next: (data: TestsRunDescription[]) => {
          this.testsRuns = data;
          this.testsRunsRows = data.map(testsRun => new TestsRunDescriptionRow(testsRun));
          this.filteredTestsRunsRows = [...this.testsRunsRows];

          this.resetSortIndicators();
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching tests runs data:', error);
        return of([]);
      })
    ).subscribe();
  }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
      const tableRows = document.querySelectorAll('#testsRunsTable tbody tr');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredTestsRunsRows.length) {
          const row = this.filteredTestsRunsRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: TestsRunDescriptionRow, isHovering: boolean): void {
    if (row.checked && row.active) {
      element.className = isHovering ? 'row-checked-and-active-hovering' : 'row-checked-and-active';
    } else if (row.checked && !row.active) {
      element.className = isHovering ? 'row-checked-hovering' : 'row-checked';
    } else if (!row.checked && row.active) {
      element.className = isHovering ? 'row-active-hovering' : 'row-active';
    } else {
      element.className = isHovering ? 'row-inactive-hovering' : 'row-inactive';
    }
  }

  markRowReviewed(row: TestsRunDescriptionRow, event: MouseEvent): void {
    row.checked = true;

    this.filteredTestsRunsRows.forEach(row => row.active = false);
    row.active = true;

    this.renderAllRows();
  }

  removeRowFromReviewed(row: TestsRunDescriptionRow, event: MouseEvent): void {
    row.checked = false;
    this.filteredTestsRunsRows.forEach(row => row.active = false);

    this.renderAllRows();
  }

  onRowMouseOver(row: TestsRunDescriptionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: TestsRunDescriptionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredTestsRunsRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Get the values to compare based on column
      switch (column) {
        case 'id':
          aValue = a.testsRun.Id;
          bValue = b.testsRun.Id;
          break;
        case 'name':
          aValue = a.testsRun.Name;
          bValue = b.testsRun.Name;
          break;
        case 'repository':
          aValue = a.testsRun.RepositoryName;
          bValue = b.testsRun.RepositoryName;
          break;
        case 'suite':
          aValue = a.testsRun.SuiteName;
          bValue = b.testsRun.SuiteName;
          break;
        case 'grid':
          aValue = a.testsRun.GridName;
          bValue = b.testsRun.GridName;
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    this.updateSortIndicators(column, direction);

    this.renderAllRows();
  }

  updateSortIndicators(activeColumn: string, direction: 'asc' | 'desc'): void {
    document.querySelectorAll('#testsRunsTable .column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

    const activeSortSvg = document.querySelector(`#testsRunsTable [data-sort="${activeColumn}"] svg`);
    if (activeSortSvg) {
      (activeSortSvg as HTMLElement).style.opacity = '1';
      activeSortSvg.innerHTML = direction === 'asc'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    }
  }

  resetSortIndicators(): void {
    this.sortDirection = {};
    // Use setTimeout to ensure DOM is rendered
    setTimeout(() => {
      document.querySelectorAll('.column-sortable svg').forEach(svg => {
        (svg as HTMLElement).style.opacity = '0.5';
        svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
      });
    }, 0);
  }

  onSearchChange(event: any): void {
    this.searchTerm = event.target.value.toLowerCase();
    this.filterData();
  }

  filterData(): void {
    if (!this.searchTerm.trim()) {
      this.filteredTestsRunsRows = [...this.testsRunsRows];
    } else {
      this.filteredTestsRunsRows = this.testsRunsRows.filter(row => {
        const testsRun = row.testsRun;

        // Search across all relevant fields
        const searchableContent = [
          testsRun.Id?.toString() || '',
          testsRun.Name || '',
          testsRun.RepositoryName || '',
          testsRun.SuiteName || '',
          testsRun.GridName || ''
        ].join(' ').toLowerCase();

        return searchableContent.includes(this.searchTerm);
      });
    }

    this.renderAllRows();
  }

  increaseLimit() {
    this.limit += 20;
    this.fetchTestsRuns();
  }
}
