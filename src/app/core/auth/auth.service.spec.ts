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

  describe('login', () => {
    it('persists the response and exposes the new user + token', async () => {
      const before = service.user();
      expect(before).not.toBeNull();

      const response = await firstValueFrom(
        service.login({ email: 'nuevo@correo.com', password: 'secreto' }),
      );

      expect(response.token).toMatch(/^mock-token-/);
      expect(response.user.email).toBe('nuevo@correo.com');
      expect(service.token()).toBe(response.token);
      expect(service.user()?.email).toBe('nuevo@correo.com');
    });
  });

  describe('register', () => {
    it('persists the response and exposes the new user', async () => {
      const response = await firstValueFrom(
        service.register({
          fullName: 'Andrea Prueba',
          email: 'andrea@correo.com',
          password: 'secreto',
          age: 17,
          region: 'Arequipa',
          interestArea: 'Ciencias',
        }),
      );

      expect(response.token).toMatch(/^mock-token-/);
      expect(response.user.fullName).toBe('Andrea Prueba');
      expect(response.user.region).toBe('Arequipa');
      expect(service.user()?.fullName).toBe('Andrea Prueba');
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