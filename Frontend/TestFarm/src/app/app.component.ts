import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';
import { User } from './models/user';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'TestFarm';
  isSidebarCollapsed = false;
  currentUser: User | null = null;
  showUserProfile = false;
  showNav = true;

  // SVG paths for toggle button icons
  private readonly CHEVRON_RIGHT_PATH = 'M 12 2 C 6.4860328 2 2 6.4860368 2 12 C 2 17.513963 6.4860328 22 12 22 C 17.513967 22 22 17.513963 22 12 C 22 6.4860368 17.513967 2 12 2 z M 12 3.5 C 16.703308 3.5 20.5 7.2966955 20.5 12 C 20.5 16.703304 16.703308 20.5 12 20.5 C 7.2966924 20.5 3.5 16.703304 3.5 12 C 3.5 7.2966955 7.2966924 3.5 12 3.5 z M 10.742188 6.9921875 A 0.750075 0.750075 0 0 0 10.21875 8.28125 L 13.9375 12 L 10.21875 15.71875 A 0.75130096 0.75130096 0 1 0 11.28125 16.78125 L 15.53125 12.53125 A 0.750075 0.750075 0 0 0 15.53125 11.46875 L 11.28125 7.21875 A 0.750075 0.750075 0 0 0 10.742188 6.9921875 z';
  private readonly CHEVRON_LEFT_PATH = 'M 12 2 C 6.4860328 2 2 6.4860368 2 12 C 2 17.513963 6.4860328 22 12 22 C 17.513967 22 22 17.513963 22 12 C 22 6.4860368 17.513967 2 12 2 z M 12 3.5 C 16.703308 3.5 20.5 7.2966955 20.5 12 C 20.5 16.703304 16.703308 20.5 12 20.5 C 7.2966924 20.5 3.5 16.703304 3.5 12 C 3.5 7.2966955 7.2966924 3.5 12 3.5 z M 13.234375 6.9921875 A 0.750075 0.750075 0 0 0 12.71875 7.21875 L 8.46875 11.46875 A 0.750075 0.750075 0 0 0 8.46875 12.53125 L 12.71875 16.78125 A 0.75130096 0.75130096 0 1 0 13.78125 15.71875 L 10.0625 12 L 13.78125 8.28125 A 0.750075 0.750075 0 0 0 13.234375 6.9921875 z';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Subscribe to current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    // Hide nav on auth pages
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const authPages = ['/login', '/register', '/confirm-email'];
      this.showNav = !authPages.some(page => event.url.includes(page));
    });

    // Check initial route
    const authPages = ['/login', '/register', '/confirm-email'];
    this.showNav = !authPages.some(page => this.router.url.includes(page));
  }

  toggleSidebar(): void {
    try {
      const sidebar = document.getElementById('sidebar');
      const toggleBtn = document.getElementById('toggleBtn');

      if (!sidebar) {
        console.warn('Sidebar element not found');
        return;
      }

      if (!toggleBtn) {
        console.warn('Toggle button element not found');
        return;
      }

      // Toggle the collapsed state
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      sidebar.classList.toggle('collapsed', this.isSidebarCollapsed);

      // Update toggle button icon
      this.updateToggleButtonIcon(toggleBtn);

      // Optional: Add accessibility attributes
      sidebar.setAttribute('aria-expanded', (!this.isSidebarCollapsed).toString());
      toggleBtn.setAttribute('aria-pressed', this.isSidebarCollapsed.toString());

    } catch (error) {
      console.error('Error toggling sidebar:', error);
    }
  }

  private updateToggleButtonIcon(toggleBtn: HTMLElement): void {
    const icon = toggleBtn.querySelector('svg path');
    if (icon) {
      icon.setAttribute('d', this.isSidebarCollapsed ? this.CHEVRON_RIGHT_PATH : this.CHEVRON_LEFT_PATH);
    }
  }

  openUserProfile(): void {
    this.showUserProfile = true;
  }

  closeUserProfile(): void {
    this.showUserProfile = false;
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
