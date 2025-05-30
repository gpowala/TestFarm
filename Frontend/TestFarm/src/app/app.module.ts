import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { BuildsComponent } from './components/builds/builds.component';
import { TestsComponent } from './components/tests/tests.component';
import { BenchmarksComponent } from './components/benchmarks/benchmarks.component';
import { GridsComponent } from './components/grids/grids.component';
import { GroupsComponent } from './components/groups/groups.component';
import { RunsComponent } from './components/runs/runs.component';
import { GridsApiHttpClientService } from './services/grids-api-http-cient-service';
import { TestsRunResultsComponent } from './components/tests-run-results/tests-run-results.component';
import { TestHistoryComponent } from './components/test-history/test-history.component';
import { ConsoleOutputToHtmlPipe } from './pipes/console-output-to-html-pipe';
import { RepositoriesComponent } from './components/repositories/repositories.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { AddArtifactDialogComponent } from './components/builds/add-artifact-dialog/add-artifact-dialog.component';
import { ArtifactsComponent } from './components/artifacts/artifacts.component';

@NgModule({  declarations: [
    AppComponent,
    BuildsComponent,
    ArtifactsComponent,
    TestsComponent,
    BenchmarksComponent,
    GridsComponent,
    GroupsComponent,
    RunsComponent,
    TestsRunResultsComponent,
    TestHistoryComponent,
    ConsoleOutputToHtmlPipe,
    RepositoriesComponent,
    AddArtifactDialogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatExpansionModule,
    HttpClientModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule,
    MatTableModule,
    FormsModule,
    ReactiveFormsModule,    MatDialogModule,
    MatInputModule,
    MatFormFieldModule,
    MatChipsModule,
    MatCardModule
  ],
  providers: [
    GridsApiHttpClientService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
