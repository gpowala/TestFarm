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
  showAddArtifactDialog: boolean = false;

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
        if (index < this.artifactsRows.length) {
          const row = this.artifactsRows[index];
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

    this.artifactsRows.forEach(row => row.active = false);
    row.active = true;

    // Re-render all rows to update their styles
    this.renderAllRows();
  }

  removeRowFromReviewed(row: ArtifactDefinitionRow, event: MouseEvent): void {
    row.checked = false;
    this.artifactsRows.forEach(row => row.active = false);

    // Re-render all rows to update their styles
    this.renderAllRows();
  }

  onRowMouseOver(row: ArtifactDefinitionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, true);
  }

  onRowMouseOut(row: ArtifactDefinitionRow, event: MouseEvent): void {
    this.updateRowClass(event.currentTarget as HTMLElement, row, false);
  }

  // // Toggle artifact selection
  // toggleSelection(artifactId: number): void {
  //   this.selection.toggle(artifactId);
  //   console.log('Selected artifact IDs:', this.selection.selected);
  // }

  // // Check if all artifacts are selected
  // isAllSelected(): boolean {
  //   const numSelected = this.selection.selected.length;
  //   const numRows = this.artifactsRows.length;
  //   return numSelected === numRows && numRows > 0;
  // }

  // // Toggle all selections
  // toggleAllSelection(): void {
  //   if (this.isAllSelected()) {
  //     this.selection.clear();
  //   } else {
  //     this.artifactsRows.forEach(row => this.selection.select(row.artifact.Id));
  //   }
  //   console.log('Selected artifact IDs:', this.selection.selected);
  // }

  // // Get selected artifacts
  // getSelectedArtifacts(): number[] {
  //   return this.selection.selected;
  // }

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

  // currentData = [];
  // sortDirection = {};

  // reviewedRows = new Set();
  // currentlyActiveRow = null;

  // handleRowHover(row, isHovering) {
  //   const isReviewed = row.classList.contains('reviewed');
  //   const isActive = row === currentlyActiveRow;

  //   if (isHovering) {
  //       if (isActive && isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.20) 0%, rgba(108, 123, 138, 0.15) 100%)';
  //       } else if (isActive && !isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.15) 0%, rgba(108, 123, 138, 0.10) 100%)';
  //       } else if (isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.10) 0%, rgba(108, 123, 138, 0.06) 100%)';
  //       } else {
  //           row.style.background = 'linear-gradient(315deg, rgba(255, 165, 0, 0.08) 0%, rgba(255, 140, 0, 0.05) 100%)';
  //       }
  //   } else {
  //       if (isActive && isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.15) 0%, rgba(108, 123, 138, 0.10) 100%)';
  //       } else if (isActive && !isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.10) 0%, rgba(108, 123, 138, 0.06) 100%)';
  //       } else if (isReviewed) {
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.06) 0%, rgba(108, 123, 138, 0.03) 100%)';
  //       } else {
  //           row.style.background = 'transparent';
  //       }
  //   }
  // }

  //       // Mark row as reviewed (single click)
  // markRowReviewed(row) {
  //   const testId = row.dataset.testId;

  //   // Set this row as currently active
  //   currentlyActiveRow = row;

  //   // Always add to reviewed state on single click
  //   if (!row.classList.contains('reviewed')) {
  //       row.classList.add('reviewed');
  //       reviewedRows.add(testId);
  //   }

  //   // Update all row backgrounds
  //   updateAllRowBackgrounds();
  // }

  // removeRowFromReviewed(row) {
  //   const testId = row.dataset.testId;

  //   // Remove from reviewed state
  //   if (row.classList.contains('reviewed')) {
  //       row.classList.remove('reviewed');
  //       reviewedRows.delete(testId);

  //       // Clear active row since we're "unreviewing" it
  //       currentlyActiveRow = null;
  //       updateAllRowBackgrounds();
  //   }
  // }

  // updateAllRowBackgrounds() {
  //   const tbody = document.getElementById('testTableBody');
  //   const rows = tbody.querySelectorAll('tr');

  //   rows.forEach(row => {
  //       const isReviewed = row.classList.contains('reviewed');
  //       const isActive = row === currentlyActiveRow;

  //       if (isActive && isReviewed) {
  //           // Active and reviewed row gets the darkest background
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.15) 0%, rgba(108, 123, 138, 0.10) 100%)';
  //       } else if (isActive && !isReviewed) {
  //           // Active but not reviewed row gets a medium background
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.10) 0%, rgba(108, 123, 138, 0.06) 100%)';
  //       } else if (isReviewed) {
  //           // Reviewed but not active rows get lighter background
  //           row.style.background = 'linear-gradient(315deg, rgba(108, 123, 138, 0.06) 0%, rgba(108, 123, 138, 0.03) 100%)';
  //       } else {
  //           // Unreviewed rows are transparent
  //           row.style.background = 'transparent';
  //       }
  //   });
  // }

  // // Initialize the table
  // renderTable(data) {
  //   const tbody = document.getElementById('testTableBody');
  //   const noResults = document.getElementById('noResults');

  //   if (data.length === 0) {
  //       tbody.innerHTML = '';
  //       noResults.style.display = 'block';
  //       return;
  //   }

  //   noResults.style.display = 'none';

  //   tbody.innerHTML = data.map((test, index) => `
  //       <tr data-test-id="${index}" style="border-bottom: 1px solid #f5f5f5; transition: all 0.3s ease; cursor: pointer;"
  //           onmouseover="handleRowHover(this, true)"
  //           onmouseout="handleRowHover(this, false)"
  //           onclick="markRowReviewed(this)"
  //           ondblclick="removeRowFromReviewed(this)">
  //           <td style="padding: 1rem; font-weight: 500; color: #2c3e50;">
  //               ${test.name}
  //           </td>
  //           <td style="padding: 1rem; color: #6c757d;">
  //               <span style="padding: 0.25rem 0.75rem; background: linear-gradient(315deg, #e9ecef 0%, #f8f9fa 100%); border-radius: 12px; font-size: 0.75rem; font-weight: 600; border: 1px solid #dee2e6;">${test.suite}</span>
  //           </td>
  //           <td style="padding: 1rem;">
  //               <span class="test-status status-${test.status}">${test.status.charAt(0).toUpperCase() + test.status.slice(1)}</span>
  //           </td>
  //           <td style="padding: 1rem; color: #6c757d; font-family: monospace;">${test.duration}</td>
  //           <td style="padding: 1rem; color: #6c757d; font-size: 0.875rem;">${test.timestamp}</td>
  //       </tr>
  //   `).join('');

  //   // Restore reviewed state after re-rendering
  //   setTimeout(() => {
  //       reviewedRows.forEach(testId => {
  //           const row = tbody.querySelector(`[data-test-id="${testId}"]`);
  //           if (row) {
  //               row.classList.add('reviewed');
  //           }
  //       });

  //       // Update all backgrounds and maintain active row
  //       updateAllRowBackgrounds();
  //   }, 10);
  // }

        // Sort functionality
        // function sortTable(column) {
        //     const isCurrentSort = sortDirection[column];
        //     const direction = isCurrentSort === 'asc' ? 'desc' : 'asc';
        //     sortDirection = { [column]: direction };

        //     currentData.sort((a, b) => {
        //         let aValue = a[column];
        //         let bValue = b[column];

        //         // Special handling for different data types
        //         if (column === 'duration') {
        //             aValue = parseFloat(aValue);
        //             bValue = parseFloat(bValue);
        //         } else if (column === 'timestamp') {
        //             aValue = a.timestampSort;
        //             bValue = b.timestampSort;
        //         } else if (typeof aValue === 'string') {
        //             aValue = aValue.toLowerCase();
        //             bValue = bValue.toLowerCase();
        //         }

        //         if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        //         if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        //         return 0;
        //     });

        //     // Update sort indicators
        //     document.querySelectorAll('.sortable svg').forEach(svg => {
        //         svg.style.opacity = '0.5';
        //         svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>';
        //     });

        //     const activeSortSvg = document.querySelector(`[data-sort="${column}"] svg`);
        //     activeSortSvg.style.opacity = '1';
        //     activeSortSvg.innerHTML = direction === 'asc'
        //         ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>'
        //         : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>';

        //     renderTable();
        // }

        // Filter and search functionality
        // function filterData() {
        //     const searchTerm = document.getElementById('testSearch').value.toLowerCase();
        //     const statusFilter = document.getElementById('statusFilter').value;
        //     const suiteFilter = document.getElementById('suiteFilter').value;

        //     currentData = testData.filter(test => {
        //         const matchesSearch = test.name.toLowerCase().includes(searchTerm) ||
        //                             test.suite.toLowerCase().includes(searchTerm);
        //         const matchesStatus = !statusFilter || test.status === statusFilter;
        //         const matchesSuite = !suiteFilter || test.suite === suiteFilter;

        //         return matchesSearch && matchesStatus && matchesSuite;
        //     });

        //     renderTable();
        // }

        // // Event listeners
        // document.querySelectorAll('.sortable').forEach(header => {
        //     header.addEventListener('click', () => {
        //         sortTable(header.dataset.sort);
        //     });

        //     // Add subtle hover effect without breaking gradient
        //     header.addEventListener('mouseenter', () => {
        //         header.style.color = '#d55e00';
        //         header.style.boxShadow = 'inset 0 -3px 0 rgba(213, 94, 0, 0.3)';
        //         header.style.transform = 'translateY(-1px)';
        //     });
        //     header.addEventListener('mouseleave', () => {
        //         header.style.color = '#2c3e50';
        //         header.style.boxShadow = 'none';
        //         header.style.transform = 'translateY(0)';
        //     });
        // });
}
