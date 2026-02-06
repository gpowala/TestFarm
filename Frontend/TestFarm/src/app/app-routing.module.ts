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
import { BenchmarksRunResultsComponent } from './components/benchmarks-run-results/benchmarks-run-results.component';
import { BenchmarksRunsComponent } from './components/benchmarks-runs/benchmarks-runs.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ConfirmEmailComponent } from './components/auth/confirm-email/confirm-email.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  {path: '', redirectTo: '/artifacts', pathMatch: 'full'},
  {path: 'login', component: LoginComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'confirm-email/:token', component: ConfirmEmailComponent},
  {path: 'artifacts', component: BuildsComponent, canActivate: [AuthGuard]},
  {path: 'repositories', component: RepositoriesComponent, canActivate: [AuthGuard]},
  {path: 'tests', component: TestsComponent, canActivate: [AuthGuard]},
  {path: 'benchmarks', component: BenchmarksComponent, canActivate: [AuthGuard]},
  {path: 'groups', component: GroupsComponent, canActivate: [AuthGuard]},
  {path: 'grids', component: GridsComponent, canActivate: [AuthGuard]},
  {path: 'runs', component: RunsComponent, canActivate: [AuthGuard]},
  {path: 'tests-run-results/:testsRunId', component: TestsRunResultsComponent, canActivate: [AuthGuard]},
  {path: 'benchmarks-runs', component: BenchmarksRunsComponent, canActivate: [AuthGuard]},
  {path: 'benchmarks-run-results/:benchmarksRunId', component: BenchmarksRunResultsComponent, canActivate: [AuthGuard]},
  {path: 'artifacts/:artifactDefinitionId', component: ArtifactsComponent, canActivate: [AuthGuard]}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
