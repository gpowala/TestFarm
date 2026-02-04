import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RepositoryDescription } from 'src/app/models/repository-description';

@Component({
  selector: 'app-add-repository-dialog',
  templateUrl: './add-repository-dialog.component.html',
  styleUrls: ['./add-repository-dialog.component.css']
})
export class AddRepositoryDialogComponent {
  @Output() repositoryAdded = new EventEmitter<Partial<RepositoryDescription>>();
  @Output() repositoryDialogClosed = new EventEmitter<void>();

  repositoryForm: FormGroup;
  showPassword: boolean = false;

  constructor(private fb: FormBuilder) {
    this.repositoryForm = this.fb.group({
      name: ['', [Validators.required]],
      url: ['', [Validators.required]],
      user: ['', [Validators.required]],
      token: ['', [Validators.required]]
    });
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
        Name: this.repositoryForm.get('name')?.value,
        Url: this.repositoryForm.get('url')?.value,
        User: this.repositoryForm.get('user')?.value,
        Token: this.repositoryForm.get('token')?.value,
        IsActive: true
      };

      this.repositoryAdded.emit(repository);
    }
  }

  onCancel(): void {
    this.repositoryDialogClosed.emit();
  }
}
