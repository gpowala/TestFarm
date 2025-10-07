import { Component, Input, OnInit } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { ArtifactsApiHttpClientService } from 'src/app/services/artifacts-api-http-cient-service';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';
import { Artifact } from 'src/app/models/artifact';
import { ActivatedRoute } from '@angular/router';
import { catchError, tap, of } from 'rxjs';

class ArtifactRow {
  active: boolean = false;
  checked: boolean = false;

  constructor(public artifact: Artifact) {}
}

@Component({
  selector: 'app-artifacts',
  templateUrl: './artifacts.component.html',
  styleUrls: ['./artifacts.component.css']
})
export class ArtifactsComponent implements OnInit {
  artifactDefinition!: ArtifactDefinition;

  artifacts: Artifact[] = [];
  artifactsRows: ArtifactRow[] = [];
  filteredArtifactsRows: ArtifactRow[] = [];

  totalBuilds: number = 0;
  activeRepositories: number = 0;
  activeBranches: number = 0;
  lastBuild: Date | null = null;

  sortDirection: { [key: string]: 'asc' | 'desc' } = {};

  searchTerm: string = '';

  constructor(private route: ActivatedRoute, private artifactsApiHttpClientService: ArtifactsApiHttpClientService) {}
  ngOnInit() {
    let artifactDefinitionId = this.route.snapshot.paramMap.get('artifactDefinitionId');

    if (artifactDefinitionId) {
      this.loadArtifactDefinition(+artifactDefinitionId);
      this.loadArtifactsFromDefinition(+artifactDefinitionId);
    }
  }
  loadArtifactDefinition(artifactDefinitionId: number) {
    this.artifactsApiHttpClientService.getArtifactDefinitionById(artifactDefinitionId).subscribe(
      (data: ArtifactDefinition) => {
        this.artifactDefinition = data;
      },
      (error: any) => {
        console.error('Error fetching artifact definition data:', error);
      }
    );
  }

  loadArtifactsFromDefinition(artifactDefinitionId: number) {
    this.artifactsApiHttpClientService.getArtifactsByDefinitionId(artifactDefinitionId).pipe(
      tap({
        next: (data: Artifact[]) => {
          this.artifacts = data;
          this.artifactsRows = data.map(artifact => new ArtifactRow(artifact));
          this.filteredArtifactsRows = [...this.artifactsRows];

          this.totalBuilds = data.length;
          this.activeRepositories = new Set(data.filter(artifact => artifact.Repository).map(artifact => artifact.Repository)).size;
          this.activeBranches = new Set(data.filter(artifact => artifact.Branch).map(artifact => artifact.Branch)).size;
          this.lastBuild = data.length > 0 ? data[0].CreationTimestamp : null;

          this.sortDirection = { 'createdAt': 'asc' };
          this.sortTable('createdAt');
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching artifacts data:', error);
        return of([]);
      })
    ).subscribe();
  }

  renderAllRows(): void {
    // Use setTimeout to ensure DOM has been updated
    setTimeout(() => {
      // Get all table rows and update their styles based on current state
      const tableRows = document.querySelectorAll('#artifactsTable tbody tr#artifact');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredArtifactsRows.length) {
          const row = this.filteredArtifactsRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: ArtifactRow, isHovering: boolean): void {
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

  markRowReviewed(row: ArtifactRow, event: MouseEvent): void {
    row.checked = true;

    this.filteredArtifactsRows.forEach(row => row.active = false);
    row.active = true;

    this.renderAllRows();
  }

  removeRowFromReviewed(row: ArtifactRow, event: MouseEvent): void {
    row.checked = false;
    this.filteredArtifactsRows.forEach(row => row.active = false);

    this.renderAllRows();
  }

  onRowMouseOver(row: ArtifactRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: ArtifactRow, event: MouseEvent): void {
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
        case 'artifactId':
          aValue = a.artifact.Id;
          bValue = b.artifact.Id;
          break;
        case 'buildId':
          aValue = a.artifact.BuildId;
          bValue = b.artifact.BuildId;
          break;
        case 'buildName':
          aValue = a.artifact.BuildName;
          bValue = b.artifact.BuildName;
          break;
        case 'repository':
          aValue = a.artifact.Repository;
          bValue = b.artifact.Repository;
          break;
        case 'branch':
          aValue = a.artifact.Branch;
          bValue = b.artifact.Branch;
          break;
        case 'revision':
          aValue = a.artifact.Revision;
          bValue = b.artifact.Revision;
          break;
        case 'createdAt':
          aValue = a.artifact.CreationTimestamp;
          bValue = b.artifact.CreationTimestamp;
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
    document.querySelectorAll('#artifactsTable .column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

    const activeSortSvg = document.querySelector(`#artifactsTable [data-sort="${activeColumn}"] svg`);
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
      document.querySelectorAll('#artifactsTable .column-sortable svg').forEach(svg => {
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
          artifact.BuildId || '',
          artifact.BuildName || '',
          artifact.Repository || '',
          artifact.Branch || '',
          artifact.Revision || ''
        ].join(' ').toLowerCase();

        return searchableContent.includes(this.searchTerm);
      });
    }

    this.renderAllRows();
  }
}
