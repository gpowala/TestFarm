import { Component, OnInit, OnDestroy } from '@angular/core';
import { GridsApiHttpClientService } from 'src/app/services/grids-api-http-cient-service';
import { GridDescription } from '../../models/grid-description';
import { HostDescription } from '../../models/host-description';
import { catchError, of, tap } from 'rxjs';

class GridDescriptionRow {
  expanded: boolean = false;

  constructor(public grid: GridDescription) {}
}

@Component({
  selector: 'app-grids',
  templateUrl: './grids.component.html',
  styleUrls: ['./grids.component.css']
})
export class GridsComponent implements OnInit, OnDestroy {
  private intervalRefreshHandler: any;
  public autoRefreshOn: boolean = true;

  grids: GridDescription[] = [];
  gridsRows: GridDescriptionRow[] = [];
  filteredGridsRows: GridDescriptionRow[] = [];
  sortDirection: { [key: string]: 'asc' | 'desc' } = {};
  searchTerm: string = '';

  constructor(private gridsApiHttpClientService: GridsApiHttpClientService) {}

  ngOnInit(): void {
    this.fetchGrids();
    this.turnOnAutoRefresh();
  }

  ngOnDestroy(): void {
    this.turnOffAutoRefresh();
  }

  turnOnAutoRefresh(): void {
    this.autoRefreshOn = true;
    this.intervalRefreshHandler = setInterval(() => this.fetchGrids(), 10000);
  }

  turnOffAutoRefresh(): void {
    if (this.intervalRefreshHandler) {
      clearInterval(this.intervalRefreshHandler);
    }
    this.autoRefreshOn = false;
  }

  fetchGrids(): void {
    this.gridsApiHttpClientService.getAllGridsData().pipe(
      tap({
        next: (data: GridDescription[]) => {
          this.grids = data;
          // Preserve expanded state when refreshing
          const expandedGridIds = this.gridsRows
            .filter(r => r.expanded)
            .map(r => r.grid.Id);

          this.gridsRows = data.map(grid => {
            const row = new GridDescriptionRow(grid);
            row.expanded = expandedGridIds.includes(grid.Id);
            return row;
          });
          this.applyFilter();
          this.resetSortIndicators();
        }
      }),
      catchError((error: any) => {
        console.error('Error fetching grids data:', error);
        return of([]);
      })
    ).subscribe();
  }

  applyFilter(): void {
    if (!this.searchTerm) {
      this.filteredGridsRows = [...this.gridsRows];
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredGridsRows = this.gridsRows.filter(row =>
        row.grid.Name.toLowerCase().includes(term) ||
        row.grid.Hosts.some(host => host.Hostname.toLowerCase().includes(term))
      );
    }
  }

  onSearchChange(event: Event): void {
    this.applyFilter();
  }

  toggleExpand(row: GridDescriptionRow, event: MouseEvent): void {
    event.stopPropagation();
    row.expanded = !row.expanded;
  }

  sortTable(column: string): void {
    const isCurrentSort = this.sortDirection[column];
    const direction: 'asc' | 'desc' = isCurrentSort === 'asc' ? 'desc' : 'asc';
    this.sortDirection = { [column]: direction };

    this.filteredGridsRows.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (column) {
        case 'id':
          aValue = a.grid.Id;
          bValue = b.grid.Id;
          break;
        case 'name':
          aValue = a.grid.Name;
          bValue = b.grid.Name;
          break;
        case 'hosts':
          aValue = a.grid.Hosts.length;
          bValue = b.grid.Hosts.length;
          break;
        case 'created':
          aValue = new Date(a.grid.CreationTimestamp).getTime();
          bValue = new Date(b.grid.CreationTimestamp).getTime();
          break;
        case 'updated':
          aValue = new Date(a.grid.LastUpdateTimestamp).getTime();
          bValue = new Date(b.grid.LastUpdateTimestamp).getTime();
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
  }

  updateSortIndicators(column: string, direction: 'asc' | 'desc'): void {
    const headers = document.querySelectorAll('.column-sortable');
    headers.forEach((header) => {
      const svg = header.querySelector('svg');
      if (svg) {
        svg.style.opacity = '0.5';
      }
    });

    const activeHeader = document.querySelector(`[data-sort="${column}"]`);
    if (activeHeader) {
      const svg = activeHeader.querySelector('svg');
      if (svg) {
        svg.style.opacity = '1';
        svg.style.transform = direction === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  }

  resetSortIndicators(): void {
    const headers = document.querySelectorAll('.column-sortable');
    headers.forEach((header) => {
      const svg = header.querySelector('svg');
      if (svg) {
        svg.style.opacity = '0.5';
        svg.style.transform = 'rotate(0deg)';
      }
    });
  }

  isRecentUpdate(timestamp: string): boolean {
    const updateTime = new Date(timestamp);
    const currentTime = new Date();
    const differenceInMs = currentTime.getTime() - updateTime.getTime();
    const differenceInMinutes = differenceInMs / (1000 * 60);
    return differenceInMinutes < 5;
  }

  getGridStatus(grid: GridDescription): string {
    if (grid.Hosts.length === 0) return 'empty';
    const allOnline = grid.Hosts.every(host => this.isRecentUpdate(host.LastUpdateTimestamp));
    const someOnline = grid.Hosts.some(host => this.isRecentUpdate(host.LastUpdateTimestamp));
    if (allOnline) return 'online';
    if (someOnline) return 'partial';
    return 'offline';
  }

  getHostStatus(host: HostDescription): string {
    return this.isRecentUpdate(host.LastUpdateTimestamp) ? 'online' : 'offline';
  }
}
