import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.css']
})
export class ConfirmEmailComponent implements OnInit {
  isLoading: boolean = true;
  isSuccess: boolean = false;
  message: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');

    if (token) {
      this.authService.confirmEmail(token).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.isSuccess = true;
          this.message = response.message || 'Email confirmed successfully!';

          // Redirect to login after 3 seconds
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        },
        error: (error) => {
          this.isLoading = false;
          this.isSuccess = false;
          this.message = error.message || 'Email confirmation failed';
        }
      });
    } else {
      this.isLoading = false;
      this.isSuccess = false;
      this.message = 'Invalid confirmation link';
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
