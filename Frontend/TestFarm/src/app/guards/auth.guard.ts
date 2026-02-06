import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // Wait for the auth check to complete, then check user
    return this.authService.checkAuthStatus().pipe(
      map(user => {
        if (user) {
          return true;
        } else {
          // Redirect to login page with return url
          return this.router.createUrlTree(['/login'], {
            queryParams: { returnUrl: state.url }
          });
        }
      })
    );
  }
  
}
