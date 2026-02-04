import { Component, OnInit } from '@angular/core';
import { RepositoriesApiHttpClientService } from '../../services/repositories-api-http-cient-service';
import { RepositoryDescription } from '../../models/repository-description';
import { ConfirmationMessageDescription } from '../../models/confirmation-message-description';
import { catchError, of, tap } from 'rxjs';

class RepositoryRow {
  active: boolean = false;
  checked: boolean = false;
  selected: boolean = false;

  constructor(public repository: RepositoryDescription) {}
}

@Component({
  selector: 'app-repositories',
  templateUrl: './repositories.component.html',
  styleUrls: ['./repositories.component.css']
})
export class RepositoriesComponent implements OnInit {
  repositories: RepositoryDescription[] = [];
  repositoriesRows: RepositoryRow[] = [];
  filteredRepositoriesRows: RepositoryRow[] = [];

  showAddRepositoryDialog: boolean = false;
  showEditRepositoryDialog: boolean = false;
  repositoryToEdit!: RepositoryDescription | null;

  sortDirection: { [key: string]: 'asc' | 'desc' } = {};
  searchTerm: string = '';

  selectedRepositoriesNumber: number = 0;

  constructor(private repositoriesApiHttpClientService: RepositoriesApiHttpClientService) {}

  ngOnInit() {
    this.fetchRepositories();
  }

  fetchRepositories() {
    this.repositoriesApiHttpClientService.getAllRepositoriesData().pipe(
      tap({
        next: (data: RepositoryDescription[]) => {
          this.repositories = data;
          this.repositoriesRows = data.map(repo => new RepositoryRow(repo));
          this.filteredRepositoriesRows = [...this.repositoriesRows];
          this.resetSortIndicators();
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching repositories data:', error);
        return of([]);
      })
    ).subscribe();
  }

  renderAllRows(): void {
    setTimeout(() => {
      const tableRows = document.querySelectorAll('#repositoriesTable tbody tr');
      tableRows.forEach((rowElement, index) => {
        if (index < this.filteredRepositoriesRows.length) {
          const row = this.filteredRepositoriesRows[index];
          this.updateRowClass(rowElement as HTMLElement, row, false);
        }
      });
    }, 0);
  }

  updateRowClass(element: HTMLElement, row: RepositoryRow, isHovering: boolean): void {
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

  markRowReviewed(row: RepositoryRow, event: MouseEvent): void {
    row.checked = true;
    this.filteredRepositoriesRows.forEach(r => r.active = false);
    row.active = true;
    this.renderAllRows();
  }

  removeRowFromReviewed(row: RepositoryRow, event: MouseEvent): void {
    row.checked = false;
    this.filteredRepositoriesRows.forEach(r => r.active = false);
    this.renderAllRows();
  }

  onRowMouseOver(row: RepositoryRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: RepositoryRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredRepositoriesRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (column) {
        case 'id':
          aValue = a.repository.Id;
          bValue = b.repository.Id;
          break;
        case 'name':
          aValue = a.repository.Name;
          bValue = b.repository.Name;
          break;
        case 'url':
          aValue = a.repository.Url;
          bValue = b.repository.Url;
          break;
        case 'user':
          aValue = a.repository.User;
          bValue = b.repository.User;
          break;
        case 'status':
          aValue = a.repository.IsActive ? 1 : 0;
          bValue = b.repository.IsActive ? 1 : 0;
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
    document.querySelectorAll('#repositoriesTable .column-sortable svg').forEach(svg => {
      (svg as HTMLElement).style.opacity = '0.5';
      svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
    });

    const activeSortSvg = document.querySelector(`#repositoriesTable [data-sort="${activeColumn}"] svg`);
    if (activeSortSvg) {
      (activeSortSvg as HTMLElement).style.opacity = '1';
      activeSortSvg.innerHTML = direction === 'asc'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';
    }
  }

  resetSortIndicators(): void {
    this.sortDirection = {};
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
      this.filteredRepositoriesRows = [...this.repositoriesRows];
    } else {
      this.filteredRepositoriesRows = this.repositoriesRows.filter(row => {
        const repo = row.repository;
        const searchableContent = [
          repo.Id?.toString() || '',
          repo.Name || '',
          repo.Url || '',
          repo.User || ''
        ].join(' ').toLowerCase();

        return searchableContent.includes(this.searchTerm);
      });
    }
    this.renderAllRows();
  }

  onSelectionChange(row: RepositoryRow, event: Event) {
    row.selected = (event.target as HTMLInputElement).checked;
    this.recalculateSelection();
  }

  recalculateSelection() {
    this.selectedRepositoriesNumber = this.repositoriesRows.filter(row => row.selected).length;
  }

  getSelectedRow(): RepositoryRow | undefined {
    return this.repositoriesRows.find(row => row.selected);
  }

  // Add Repository Dialog
  addRepository() {
    this.showAddRepositoryDialog = true;
  }

  repositoryAdded(result: any) {
    this.showAddRepositoryDialog = false;

    this.repositoriesApiHttpClientService.addRepository(
      result.Name,
      result.Url,
      result.User,
      result.Token
    ).subscribe({
      next: (data: RepositoryDescription) => {
        this.fetchRepositories();
        console.log('Repository added successfully:', data);
      },
      error: (error: any) => {
        console.error('Error adding repository:', error);
      }
    });
  }

  repositoryDialogClosed() {
    this.showAddRepositoryDialog = false;
  }

  // Edit Repository Dialog
  editRepository(repository: RepositoryDescription) {
    this.repositoryToEdit = repository;
    this.showEditRepositoryDialog = true;
  }

  repositoryChanged(result: any) {
    if (result.Id === -1) {
      throw new Error('Repository Id should not be -1 when editing an existing repository.');
    }

    this.repositoriesApiHttpClientService.updateRepository(
      result.Id,
      result.Name,
      result.Url,
      result.User,
      result.Token
    ).subscribe({
      next: (data: RepositoryDescription) => {
        this.fetchRepositories();
        this.editRepositoryDialogClosed();
        console.log('Repository updated successfully:', data);
      },
      error: (error: any) => {
        this.editRepositoryDialogClosed();
        console.error('Error updating repository:', error);
      }
    });
  }

  editRepositoryDialogClosed() {
    this.showEditRepositoryDialog = false;
    this.repositoryToEdit = null;
  }

  // Remove Repository
  removeRepository(id: number, event: MouseEvent) {
    event.stopPropagation();

    if (confirm('Are you sure you want to remove this repository?')) {
      this.repositoriesApiHttpClientService.removeRepository(id).subscribe({
        next: (data: ConfirmationMessageDescription) => {
          this.fetchRepositories();
          console.log('Repository removed:', data.message);
        },
        error: (error: any) => {
          console.error('Error removing repository:', error);
        }
      });
    }
  }
}
