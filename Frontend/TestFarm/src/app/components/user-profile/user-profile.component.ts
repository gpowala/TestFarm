import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/models/user';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.css']
})
export class UserProfileComponent {
  @Input() user: User | null = null;
  @Output() close = new EventEmitter<void>();

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.close.emit();
        this.router.navigate(['/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // Still close and redirect even on error
        this.close.emit();
        this.router.navigate(['/login']);
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
