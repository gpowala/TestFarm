import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { BuildsComponent } from './components/builds/builds.component';
import { TestsComponent } from './components/tests/tests.component';
import { BenchmarksComponent } from './components/benchmarks/benchmarks.component';
import { GroupsComponent } from './components/groups/groups.component';
import { GridsComponent } from './components/grids/grids.component';
import { RunsComponent } from './components/runs/runs.component';
import { TestsRunResultsComponent } from './components/tests-run-results/tests-run-results.component';
import { RepositoriesComponent } from './components/repositories/repositories.component';
import { ArtifactsComponent } from './components/artifacts/artifacts.component';

const routes: Routes = [
  {path: '', redirectTo: '/artifacts', pathMatch: 'full'},
  {path: 'artifacts', component: BuildsComponent},
  {path: 'repositories', component: RepositoriesComponent},
  {path: 'tests', component: TestsComponent},
  {path: 'benchmarks', component: BenchmarksComponent},
  {path: 'groups', component: GroupsComponent},
  {path: 'grids', component: GridsComponent},
  {path: 'runs', component: RunsComponent},
  {path: 'tests-run-results/:testsRunId', component: TestsRunResultsComponent},
  {path: 'artifacts/:artifactDefinitionId', component: ArtifactsComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
