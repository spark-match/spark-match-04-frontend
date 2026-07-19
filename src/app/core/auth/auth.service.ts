import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from '../models/user.model';

const TOKEN_KEY = 'spark-match:token';
const USER_KEY = 'spark-match:user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/auth`;

  // Modificado: Si usas mocks y no hay sesión, creamos una sesión falsa al instante para que no se quede cargando
  private readonly _user = signal<AuthUser | null>(this.getInitialUser());
  private readonly _token = signal<string | null>(this.getInitialToken());

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();

  // Mantenemos el computed para que el guard funcione correctamente al llamarlo auth.isAuthenticated()
  readonly isAuthenticated = computed(() => this._token() !== null);

  login(payload: LoginPayload): Observable<AuthResponse> {
    if (environment.useMocks) {
      const response = this.buildMockResponse({
        fullName: payload.email.split('@')[0],
        email: payload.email,
      });
      return of(response).pipe(
        delay(500),
        tap((res) => this.persistSession(res)),
      );
    }
    return this.http
      .post<AuthResponse>(`${this.base}/login`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    if (environment.useMocks) {
      const response = this.buildMockResponse({
        fullName: payload.fullName,
        email: payload.email,
        age: payload.age,
        region: payload.region,
        interestArea: payload.interestArea,
      });
      return of(response).pipe(
        delay(600),
        tap((res) => this.persistSession(res)),
      );
    }
    return this.http
      .post<AuthResponse>(`${this.base}/register`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._token.set(response.token);
    this._user.set(response.user);
  }

  private buildMockResponse(partial: Partial<AuthUser> & { email: string }): AuthResponse {
    return {
      user: {
        id: crypto.randomUUID(),
        fullName: partial.fullName ?? 'Usuario Spark Match',
        email: partial.email,
        age: partial.age,
        region: partial.region,
        interestArea: partial.interestArea,
      },
      token: `mock-token-${crypto.randomUUID()}`,
    };
  }

  // Métodos auxiliares inteligentes para el arranque con mocks:
  private getInitialToken(): string | null {
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (!localToken && environment.useMocks) {
      return 'mock-initial-token';
    }
    return localToken;
  }

  private getInitialUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw && environment.useMocks) {
      return {
        id: 'mock-id',
        fullName: 'Estudiante Explorador',
        email: 'estudiante@sparkmatch.pe',
        region: 'lima',
      };
    }
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
