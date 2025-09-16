import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenchmarksRunsComponent } from './benchmarks-runs.component';

describe('BenchmarksRunsComponent', () => {
  let component: BenchmarksRunsComponent;
  let fixture: ComponentFixture<BenchmarksRunsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BenchmarksRunsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BenchmarksRunsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
