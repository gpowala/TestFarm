import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BuildsComponent } from './components/builds/builds.component';
import { TestsComponent } from './components/tests/tests.component';
import { BenchmarksComponent } from './components/benchmarks/benchmarks.component';
import { GroupsComponent } from './components/groups/groups.component';
import { GridsComponent } from './components/grids/grids.component';
import { RunsComponent } from './components/runs/runs.component';

const routes: Routes = [
  {path: 'builds', component: BuildsComponent},
  {path: 'tests', component: TestsComponent},
  {path: 'benchmarks', component: BenchmarksComponent},
  {path: 'groups', component: GroupsComponent},
  {path: 'grids', component: GridsComponent},
  {path: 'runs', component: RunsComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
