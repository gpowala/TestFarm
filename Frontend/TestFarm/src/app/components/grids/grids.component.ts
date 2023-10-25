import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { MatAccordion } from '@angular/material/expansion';
import { GridsApiHttpClientService } from 'src/app/services/grids-api-http-cient-service';
import { GridDescription } from '../../models/grid-description';

@Component({
  selector: 'app-grids',
  templateUrl: './grids.component.html',
  styleUrls: ['./grids.component.css'],
  providers: [GridsApiHttpClientService]
})
export class GridsComponent implements OnInit, OnDestroy{
  @ViewChild(MatAccordion) accordion!: MatAccordion;

  private intervalRefreshHandler: NodeJS.Timer | undefined;
  public autoRefreshOn: boolean;

  public gridsDescription: GridDescription[];

  constructor(private gridsApiHttpClientService: GridsApiHttpClientService) {
    this.gridsDescription = [];
    this.autoRefreshOn = false;
  }

  ngOnInit(): void {
    this.refreshGridsDescription();
    this.turnOnAutoRefresh();
  }

  ngOnDestroy(): void {
    this.turnOffAutoRefresh();
  }

  turnOnAutoRefresh(): void {
    this.autoRefreshOn = true;
    this.intervalRefreshHandler = setInterval(() => this.refreshGridsDescription(), 10000);
  }

  turnOffAutoRefresh(): void {
    clearInterval(this.intervalRefreshHandler);
    this.autoRefreshOn = false;
  }

  refreshGridsDescription(): void {
    this.gridsApiHttpClientService.getAllGridsData().subscribe((data: GridDescription[]) => {
      this.gridsDescription = data.map(grid => {
        let modifiedGrid = grid;

        modifiedGrid.creationTime = this.formatDate(new Date(grid.creationTime));
        modifiedGrid.lastUpdateTime = this.formatDate(new Date(grid.lastUpdateTime));

        return modifiedGrid;
      });
    });
  }

  formatDate(date: Date): string {
    const ensureLeadingZero = (value: number): string => {
      if (value < 10)
        return `0${value}`;
      else
        return `${value}`;
    };

    return `${ensureLeadingZero(date.getDate())}/${ensureLeadingZero(date.getMonth() + 1)}/${ensureLeadingZero(date.getFullYear())} ${ensureLeadingZero(date.getHours())}:${ensureLeadingZero(date.getMinutes())}:${ensureLeadingZero(date.getSeconds())}`;
  }
}
