import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TestsRunResultsComponent } from './tests-run-results.component';

describe('TestsRunResultsComponent', () => {
  let component: TestsRunResultsComponent;
  let fixture: ComponentFixture<TestsRunResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TestsRunResultsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TestsRunResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
