import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ArtifactDefinition } from 'src/app/models/artifact-definition';

@Component({
  selector: 'app-edit-artifact-definition-dialog',
  templateUrl: './edit-artifact-definition-dialog.component.html',
  styleUrls: ['./edit-artifact-definition-dialog.component.css']
})
export class EditArtifactDefinitionDialogComponent implements OnInit {
  @Input() artifactDefinition!: ArtifactDefinition | null;

  @Output() artifactDefinitionChanged = new EventEmitter<Partial<ArtifactDefinition>>();
  @Output() editArtifactDefinitionDialogClosed = new EventEmitter<void>();

  artifactForm: FormGroup;
  tags: string[] = [];
  newTagInput: string = '';

  constructor(
    private fb: FormBuilder
  ) {
    this.artifactForm = this.fb.group({
      name: ['', [Validators.required]],
      installScript: ['', [Validators.required]],
      tags: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.tags = [...(this.artifactDefinition?.Tags || [])];

    // Pre-populate form with existing artifact definition values
    if (this.artifactDefinition) {
      this.artifactForm.patchValue({
        name: this.artifactDefinition.Name || '',
        installScript: this.artifactDefinition.InstallScript || ''
      });

      // Populate tags FormArray
      this.tags.forEach(tag => {
        this.tagsFormArray.push(this.fb.control(tag));
      });
    }

    console.log(this.artifactDefinition);
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
      const artifact: Partial<ArtifactDefinition> = {
        Id: this.artifactDefinition ? this.artifactDefinition.Id : -1,
        Name: this.artifactForm.get('name')?.value,
        InstallScript: this.artifactForm.get('installScript')?.value,
        Tags: this.tags
      };

      this.artifactDefinitionChanged.emit(artifact);
    }
  }

  onCancel(): void {
    this.editArtifactDefinitionDialogClosed.emit();
  }
}
