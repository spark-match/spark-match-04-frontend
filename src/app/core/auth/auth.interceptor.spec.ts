import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from '../http/error.interceptor';

describe('auth and error interceptors', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.verify();
    auth.logout();
    localStorage.clear();
  });

  it('adds the bearer token to outgoing requests', () => {
    http.get('/api/test').subscribe();

    const request = httpTesting.expectOne('/api/test');
    expect(request.request.headers.get('Authorization')).toBe('Bearer mock-initial-token');
    request.flush({ ok: true });
  });

  it('does not add a bearer token after logout', () => {
    auth.logout();
    http.get('/api/test').subscribe();

    const request = httpTesting.expectOne('/api/test');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ok: true });
  });

  it('clears the session and redirects to login on 401', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.get('/api/test').subscribe({ error: () => undefined });

    const request = httpTesting.expectOne('/api/test');
    request.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
