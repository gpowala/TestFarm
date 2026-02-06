import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { User } from '../models/user';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.baseApiUrl}/api/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private authCheckComplete = false;

  constructor(private http: HttpClient) {
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    this.getCurrentUser().subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
        this.authCheckComplete = true;
      },
      error: () => {
        this.currentUserSubject.next(null);
        this.authCheckComplete = true;
      }
    });
  }

  checkAuthStatus(): Observable<User | null> {
    if (this.authCheckComplete) {
      return of(this.currentUserSubject.value);
    }
    
    return this.getCurrentUser().pipe(
      tap(user => {
        this.currentUserSubject.next(user);
        this.authCheckComplete = true;
      }),
      catchError(() => {
        this.currentUserSubject.next(null);
        this.authCheckComplete = true;
        return of(null);
      })
    );
  }

  register(username: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { username, email, password }, { withCredentials: true })
      .pipe(catchError(this.handleError));
  }

  login(username: string, password: string): Observable<User> {
    return this.http.post<{ user: User }>(`${this.apiUrl}/login`, { username, password }, { withCredentials: true })
      .pipe(
        map(response => response.user),
        tap(user => this.currentUserSubject.next(user)),
        catchError(this.handleError)
      );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => this.currentUserSubject.next(null)),
        catchError(this.handleError)
      );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/me`, { withCredentials: true })
      .pipe(
        map(response => response.user),
        catchError(this.handleError)
      );
  }

  confirmEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/confirm-email/${token}`)
      .pipe(catchError(this.handleError));
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = error.error?.error || error.message || errorMessage;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
