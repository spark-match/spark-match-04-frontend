import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state (mocks enabled)', () => {
    it('seeds a mock user when useMocks is true and no session exists', () => {
      expect(environment.useMocks).toBe(true);
      expect(service.user()).not.toBeNull();
      expect(service.user()?.email).toBe('estudiante@sparkmatch.pe');
    });

    it('seeds a mock token when useMocks is true and no session exists', () => {
      expect(service.token()).toBe('mock-initial-token');
      expect(service.isAuthenticated()).toBe(true);
    });
  });

  /*
   * `isAdmin` decide si la interfaz enseña el panel de administración. Falla
   * cerrado, y estas pruebas fijan exactamente eso, incluido el caso raro que
   * de verdad ocurre: una sesión guardada en localStorage antes de que el
   * backend empezara a devolver el rol.
   *
   * No es control de acceso. Quien decide es el servidor, con los 403 de
   * /v1/users y /v1/audit. Esto solo evita enseñar puertas cerradas.
   */
  describe('isAdmin', () => {
    /** Siembra una sesión en localStorage y construye el servicio leyéndola. */
    function conSesion(user: Record<string, unknown>): AuthService {
      localStorage.setItem('spark-match:token', 'un-token');
      localStorage.setItem('spark-match:user', JSON.stringify(user));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      return TestBed.inject(AuthService);
    }

    const BASE = { id: 'x', email: 'a@b.com', fullName: 'A B' };

    it('es falso para un estudiante', () => {
      const auth = conSesion({ ...BASE, role: 'student' });
      expect(auth.user()?.role).toBe('student');
      expect(auth.isAdmin()).toBe(false);
    });

    it('es verdadero solo cuando el rol es admin', () => {
      expect(conSesion({ ...BASE, role: 'admin' }).isAdmin()).toBe(true);
    });

    it('es falso cuando la sesion guardada no trae rol', () => {
      // El caso real: sesiones anteriores al despliegue del backend que envía
      // el rol. Sin rol conocido, se esconde. Nunca al revés.
      const auth = conSesion(BASE);
      expect(auth.user()?.role).toBeUndefined();
      expect(auth.isAdmin()).toBe(false);
    });

    it('es falso ante un rol desconocido', () => {
      expect(conSesion({ ...BASE, role: 'superadmin' }).isAdmin()).toBe(false);
    });
  });

  describe('login', () => {
    it('persists the response and exposes the new user + token', async () => {
      const before = service.user();
      expect(before).not.toBeNull();

      const response = await firstValueFrom(
        service.login({ email: 'nuevo@correo.com', password: 'secreto' }),
      );

      expect(response.accessToken).toMatch(/^mock-token-/);
      expect(response.user.email).toBe('nuevo@correo.com');
      expect(service.token()).toBe(response.accessToken);
      expect(service.user()?.email).toBe('nuevo@correo.com');
    });

    // El backend devuelve `accessToken`, no `token`. Con el nombre viejo,
    // localStorage guardaba undefined y toda peticion autenticada daba 401.
    it('guarda el accessToken en localStorage, no undefined', async () => {
      const response = await firstValueFrom(
        service.login({ email: 'nuevo@correo.com', password: 'secreto' }),
      );

      expect(localStorage.getItem('spark-match:token')).toBe(response.accessToken);
      expect(localStorage.getItem('spark-match:token')).not.toBe('undefined');
    });

    it('expone expiresIn del contrato del backend', async () => {
      const response = await firstValueFrom(
        service.login({ email: 'nuevo@correo.com', password: 'secreto' }),
      );

      expect(typeof response.expiresIn).toBe('number');
    });
  });

  describe('register', () => {
    const payload = {
      fullName: 'Andrea Prueba',
      email: 'andrea@correo.com',
      password: 'secreto',
      age: 17,
      region: 'Arequipa',
      interestArea: 'Ciencias',
    };

    it('devuelve el usuario creado que responde el backend', async () => {
      const response = await firstValueFrom(service.register(payload));

      expect(response.id).toBeTruthy();
      expect(response.email).toBe('andrea@correo.com');
      expect(response.fullName).toBe('Andrea Prueba');
      expect(response.createdAt).toBeTruthy();
    });

    // El registro responde 201 sin token: no abre sesion. La pagina redirige a
    // login. Antes se persistia una sesion inventada y se navegaba a /filters.
    it('no abre sesion ni toca el usuario actual', async () => {
      const tokenAntes = service.token();
      const userAntes = service.user();

      await firstValueFrom(service.register(payload));

      expect(service.token()).toBe(tokenAntes);
      expect(service.user()).toBe(userAntes);
      expect(service.user()?.fullName).not.toBe('Andrea Prueba');
    });
  });

  describe('logout', () => {
    it('clears the user, token, and localStorage session', () => {
      service.logout();

      expect(service.user()).toBeNull();
      expect(service.token()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(localStorage.getItem('spark-match:token')).toBeNull();
      expect(localStorage.getItem('spark-match:user')).toBeNull();
    });
  });

  describe('session restore from localStorage', () => {
    it('reads a stored session on construction', () => {
      localStorage.setItem('spark-match:token', 'stored-token');
      localStorage.setItem(
        'spark-match:user',
        JSON.stringify({ id: 'u1', fullName: 'Stored User', email: 's@x.com' }),
      );

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      const restored = TestBed.inject(AuthService);

      expect(restored.token()).toBe('stored-token');
      expect(restored.user()?.fullName).toBe('Stored User');
    });
  });
});