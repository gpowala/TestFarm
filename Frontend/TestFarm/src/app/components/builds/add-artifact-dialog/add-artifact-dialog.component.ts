import { Component, Inject, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Artifact } from 'src/app/models/artifact';

@Component({
  selector: 'app-add-artifact-dialog',
  templateUrl: './add-artifact-dialog.component.html',
  styleUrls: ['./add-artifact-dialog.component.css']
})
export class AddArtifactDialogComponent implements OnInit, AfterViewInit {
  artifactForm: FormGroup;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  tags: string[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddArtifactDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private cdr: ChangeDetectorRef
  ) {
    this.artifactForm = this.fb.group({
      buildId: ['', [Validators.required]],
      name: ['', [Validators.required]],
      repository: ['', [Validators.required]],
      branch: ['', [Validators.required]],
      revision: ['', [Validators.required]],
      workItemUrl: ['', [Validators.required]],
      buildPageUrl: ['', [Validators.required]],
      tags: this.fb.array([])
    });
  }

  ngOnInit(): void {
    // Initial form setup can go here
  }

  ngAfterViewInit(): void {
    // Force detection of changes to make sure form elements are properly rendered
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  get tagsFormArray(): FormArray {
    return this.artifactForm.get('tags') as FormArray;
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      this.tags.push(value);
      this.tagsFormArray.push(this.fb.control(value));
    }

    event.chipInput!.clear();
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);

    if (index >= 0) {
      this.tags.splice(index, 1);
      this.tagsFormArray.removeAt(index);
    }
  }  onSubmit(): void {
    if (this.artifactForm.valid) {
      const artifact: Partial<Artifact> = {
        ArtifactDefinitionId: this.data.selectedArtifact.Id,
        BuildId: this.artifactForm.get('buildId')?.value,
        BuildName: this.artifactForm.get('name')?.value,
        Repository: this.artifactForm.get('repository')?.value,
        Branch: this.artifactForm.get('branch')?.value,
        Revision: this.artifactForm.get('revision')?.value,
        WorkItemUrl: this.artifactForm.get('workItemUrl')?.value,
        BuildPageUrl: this.artifactForm.get('buildPageUrl')?.value,
        Tags: this.tags
      };

      this.dialogRef.close(artifact);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
