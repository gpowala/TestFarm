import { Component, OnInit } from '@angular/core';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';
import { SelectionModel } from '@angular/cdk/collections';
import { catchError, of, tap } from 'rxjs';

class ArtifactDefinitionRow {
  active: boolean = false;
  checked: boolean = false;

  constructor(public artifact: ArtifactDefinition) {}
}

@Component({
  selector: 'app-builds',
  templateUrl: './builds.component.html',
  styleUrls: ['./builds.component.css']
})
export class BuildsComponent implements OnInit {
  artifacts: ArtifactDefinition[] = [];
  artifactsRows: ArtifactDefinitionRow[] = [];
  filteredArtifactsRows: ArtifactDefinitionRow[] = [];
  showAddArtifactDialog: boolean = false;
  sortDirection: { [key: string]: 'asc' | 'desc' } = {};
  searchTerm: string = '';

  constructor(
    private artifactsApiHttpClientService: ArtifactsApiHttpClientService
  ) {}

  ngOnInit() {
    this.fetchArtifacts();
  }

  fetchArtifacts() {
    this.artifactsApiHttpClientService.getAllArtifactsDefinitions().pipe(
      tap({
        next: (data: ArtifactDefinition[]) => {
          this.artifacts = data;
          this.artifactsRows = data.map(artifact => new ArtifactDefinitionRow(artifact));
          this.filteredArtifactsRows = [...this.artifactsRows];
          // Reset sort indicators when data is refreshed
          this.resetSortIndicators();
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching artifacts data:', error);
        return of([]); // Return an empty array as a fallback
      })
    ).subscribe();
  }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
      const tableRows = document.querySelectorAll('tbody tr');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredArtifactsRows.length) {
          const row = this.filteredArtifactsRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: ArtifactDefinitionRow, isHovering: boolean): void {
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

  markRowReviewed(row: ArtifactDefinitionRow, event: MouseEvent): void {
    row.checked = true;

    this.filteredArtifactsRows.forEach(row => row.active = false);
    row.active = true;

    this.renderAllRows();
  }

  removeRowFromReviewed(row: ArtifactDefinitionRow, event: MouseEvent): void {
    row.checked = false;
    this.filteredArtifactsRows.forEach(row => row.active = false);

    this.renderAllRows();
  }

  onRowMouseOver(row: ArtifactDefinitionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: ArtifactDefinitionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredArtifactsRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Get the values to compare based on column
      switch (column) {
        case 'id':
          aValue = a.artifact.Id;
          bValue = b.artifact.Id;
          break;
        case 'name':
          aValue = a.artifact.Name;
          bValue = b.artifact.Name;
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
    document.querySelectorAll('.column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

    const activeSortSvg = document.querySelector(`[data-sort="${activeColumn}"] svg`);
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
      this.filteredArtifactsRows = [...this.artifactsRows];
    } else {
      this.filteredArtifactsRows = this.artifactsRows.filter(row => {
        const artifact = row.artifact;

        // Search across all relevant fields
        const searchableContent = [
          artifact.Id?.toString() || '',
          artifact.Name || '',
          ...(artifact.Tags || [])
        ].join(' ').toLowerCase();

        return searchableContent.includes(this.searchTerm);
      });
    }

    this.renderAllRows();
  }

  createArtifactDefinition() {
    this.showAddArtifactDialog = true;
  }

  onDialogClose(result?: any) {
    this.showAddArtifactDialog = false;
    if (result) {
      this.artifactsApiHttpClientService.addArtifactDefinition(
        result.Name,
        result.InstallScript,
        result.Tags
      ).subscribe(
        (data: ArtifactDefinition) => {
          this.fetchArtifacts();
          console.log('Artifact added successfully:', data);
        },
        (error: any) => {
          console.error('Error adding artifact:', error);
        }
      );
    }
  }

  addArtifact() {
    // TODO: Implement add artifact functionality
    console.log('Add artifact functionality not implemented yet');
  }

  removeArtifact(id: number) {
    this.artifactsApiHttpClientService.removeArtifactDefinition(id).subscribe(
      () => {
        this.fetchArtifacts();
      },
      (error: any) => {
        console.error('Error fetching artifacts data:', error);
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
