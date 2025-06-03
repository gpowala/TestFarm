import { Component, Inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';

@Component({
  selector: 'app-add-artifact-dialog',
  templateUrl: './add-artifact-definition-dialog.component.html',
  styleUrls: ['./add-artifact-definition-dialog.component.css']
})
export class AddArtifactDefinitionDialogComponent {
  artifactForm: FormGroup;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  tags: string[] = [];

  // Monaco editor options
  editorOptions = {
    theme: 'vs-dark',
    language: 'python',
    automaticLayout: true,
    minimap: {
      enabled: false
    },
    scrollBeyondLastLine: false,
    fontSize: 14,
    lineNumbers: 'on',
    renderLineHighlight: 'all',
    lineHeight: 20
  };

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddArtifactDefinitionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.artifactForm = this.fb.group({
      name: ['', [Validators.required]],
      installScript: ['', [Validators.required]],
      tags: this.fb.array([])
    });
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
  }

  onSubmit(): void {
    if (this.artifactForm.valid) {
      const artifact: Partial<ArtifactDefinition> = {
        Name: this.artifactForm.get('name')?.value,
        InstallScript: this.artifactForm.get('installScript')?.value,
        Tags: this.tags
      };

      this.dialogRef.close(artifact);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
