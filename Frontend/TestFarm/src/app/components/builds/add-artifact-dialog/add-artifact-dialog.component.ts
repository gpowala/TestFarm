import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Artifact } from 'src/app/models/artifact';

@Component({
  selector: 'app-add-artifact-dialog',
  templateUrl: './add-artifact-dialog.component.html',
  styleUrls: ['./add-artifact-dialog.component.css']
})
export class AddArtifactDialogComponent {
  @Input() artifactDefinitionId: number | undefined;
  @Input() artifactDefinitionName: string | undefined;

  @Output() artifactAdded = new EventEmitter<Partial<Artifact>>();
  @Output() artifactDialogClosed = new EventEmitter<void>();

  artifactForm: FormGroup;
  tags: string[] = [];
  newTagInput: string = '';

  constructor(
    private fb: FormBuilder
  ) {
    this.artifactForm = this.fb.group({
      buildId: ['', [Validators.required]],
      buildName: ['', [Validators.required]],
      repository: ['', [Validators.required]],
      branch: ['', [Validators.required]],
      revision: ['', [Validators.required]],
      workItemUrl: ['', [Validators.required]],
      buildPageUrl: ['', [Validators.required]],
      tags: this.fb.array([])
    });
  }

  get tagsFormArray(): FormArray {
    return this.artifactForm.get('tags') as FormArray;
  }

  addTag(): void {
    const value = this.newTagInput.trim();

    if (value && !this.tags.includes(value)) {
      this.tags.push(value);
      this.tagsFormArray.push(this.fb.control(value));
      this.newTagInput = '';
    }
  }

  onTagInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);

    if (index >= 0) {
      this.tags.splice(index, 1);
      this.tagsFormArray.removeAt(index);
    }
  }

  // Form field validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.artifactForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.artifactForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
    }
    return '';
  }

  onSubmit(): void {
    if (this.artifactForm.valid) {
      const artifact: Partial<Artifact> = {
        ArtifactDefinitionId: this.artifactDefinitionId,
        BuildId: this.artifactForm.get('buildId')?.value,
        BuildName: this.artifactForm.get('name')?.value,
        Repository: this.artifactForm.get('repository')?.value,
        Branch: this.artifactForm.get('branch')?.value,
        Revision: this.artifactForm.get('revision')?.value,
        WorkItemUrl: this.artifactForm.get('workItemUrl')?.value,
        BuildPageUrl: this.artifactForm.get('buildPageUrl')?.value,
        Tags: this.tags
      };

      this.artifactAdded.emit(artifact);
    }
  }

  onCancel(): void {
    this.artifactDialogClosed.emit();
  }
}
