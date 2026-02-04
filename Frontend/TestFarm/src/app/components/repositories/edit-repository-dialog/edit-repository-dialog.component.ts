import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RepositoryDescription } from 'src/app/models/repository-description';

@Component({
  selector: 'app-edit-repository-dialog',
  templateUrl: './edit-repository-dialog.component.html',
  styleUrls: ['./edit-repository-dialog.component.css']
})
export class EditRepositoryDialogComponent implements OnInit {
  @Input() repository!: RepositoryDescription | null;

  @Output() repositoryChanged = new EventEmitter<Partial<RepositoryDescription>>();
  @Output() editRepositoryDialogClosed = new EventEmitter<void>();

  repositoryForm: FormGroup;
  showPassword: boolean = false;

  constructor(private fb: FormBuilder) {
    this.repositoryForm = this.fb.group({
      name: ['', [Validators.required]],
      url: ['', [Validators.required]],
      user: ['', [Validators.required]],
      token: ['']
    });
  }

  ngOnInit(): void {
    // Pre-populate form with existing repository values
    if (this.repository) {
      this.repositoryForm.patchValue({
        name: this.repository.Name || '',
        url: this.repository.Url || '',
        user: this.repository.User || '',
        token: '' // Don't pre-fill token for security reasons
      });
    }
  }

  // Form field validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.repositoryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.repositoryForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} is required`;
      }
    }
    return '';
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.repositoryForm.valid) {
      const repository: Partial<RepositoryDescription> = {
        Id: this.repository ? this.repository.Id : -1,
        Name: this.repositoryForm.get('name')?.value,
        Url: this.repositoryForm.get('url')?.value,
        User: this.repositoryForm.get('user')?.value,
        Token: this.repositoryForm.get('token')?.value,
        IsActive: this.repository?.IsActive ?? true
      };

      this.repositoryChanged.emit(repository);
    }
  }

  onCancel(): void {
    this.editRepositoryDialogClosed.emit();
  }
}
