import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { delay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  AuthUser,
  LoginPayload,
  LoginResponse,
  RegisterPayload,
  RegisterResponse,
} from '../../shared/models/user.model';

const TOKEN_KEY = 'spark-match:token';
const USER_KEY = 'spark-match:user';

@Service()
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

  /**
   * Falla cerrado a propósito: solo es admin quien trae `role === 'admin'`.
   *
   * Sin sesión, con el rol ausente o con cualquier otro valor, la respuesta es
   * `false`. La ausencia se da de verdad en dos casos: una sesión guardada en
   * `localStorage` antes de que el backend enviara el rol, y el hueco entre
   * desplegar este frontend y desplegar el backend que lo incluye. En los dos
   * conviene esconder de más y no de menos.
   *
   * Y hay que decirlo claro: esto NO es control de acceso. Quien decide es el
   * servidor, que devuelve 403 en `/v1/users` y `/v1/audit` a quien no es
   * admin. Esto solo evita enseñar puertas que al abrirlas dan 403. Cualquiera
   * puede editar su `localStorage` y poner `"role":"admin"`; lo único que
   * conseguirá es ver un panel cuyas llamadas siguen fallando.
   */
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  login(payload: LoginPayload): Observable<LoginResponse> {
    if (environment.useMocks) {
      const response = this.buildMockLoginResponse({
        fullName: payload.email.split('@')[0],
        email: payload.email,
      });
      return of(response).pipe(
        delay(500),
        tap((res) => this.persistSession(res)),
      );
    }
    return this.http
      .post<LoginResponse>(`${this.base}/login`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  /**
   * El registro NO abre sesion: el backend devuelve 201 con el usuario creado
   * y ningun token. La pagina que llama debe redirigir a login.
   *
   * `region` e `interestArea` se siguen enviando porque el formulario los pide,
   * pero el schema del backend los ignora (zod descarta claves desconocidas).
   * Cuando exista el endpoint de perfil extendido habra que persistirlos.
   */
  register(payload: RegisterPayload): Observable<RegisterResponse> {
    if (environment.useMocks) {
      return of(this.buildMockRegisterResponse(payload)).pipe(delay(600));
    }
    return this.http.post<RegisterResponse>(`${this.base}/register`, payload);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
  }

  private persistSession(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this._token.set(response.accessToken);
    this._user.set(response.user);
  }

  private buildMockLoginResponse(
    partial: Partial<AuthUser> & { email: string },
  ): LoginResponse {
    return {
      accessToken: `mock-token-${crypto.randomUUID()}`,
      expiresIn: 3600,
      user: {
        id: crypto.randomUUID(),
        fullName: partial.fullName ?? 'Usuario Spark Match',
        email: partial.email,
        // `student` porque es lo que produce el alta real desde la migración
        // 005. Que el mock local sea admin daría una experiencia de desarrollo
        // que ningún usuario tiene, y escondería justo el camino que hay que
        // ver a diario.
        role: partial.role ?? 'student',
        age: partial.age ?? 17,
        region: partial.region ?? 'Lima Metropolitana',
        interestArea: partial.interestArea ?? 'Tecnología e innovación',
      },
    };
  }

  private buildMockRegisterResponse(payload: RegisterPayload): RegisterResponse {
    return {
      id: crypto.randomUUID(),
      email: payload.email,
      fullName: payload.fullName,
      createdAt: new Date().toISOString(),
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
        role: 'student',
        age: 17,
        region: 'Lima Metropolitana',
        interestArea: 'Tecnología e innovación',
      };
    }
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
