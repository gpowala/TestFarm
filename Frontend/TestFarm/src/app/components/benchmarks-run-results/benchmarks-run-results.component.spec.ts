import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenchmarksRunResultsComponent } from './benchmarks-run-results.component';

describe('BenchmarksRunResultsComponent', () => {
  let component: BenchmarksRunResultsComponent;
  let fixture: ComponentFixture<BenchmarksRunResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BenchmarksRunResultsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BenchmarksRunResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
