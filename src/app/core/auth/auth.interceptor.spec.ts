import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

class AuthServiceStub {
  readonly token = signal<string | null>(null);
  logout = vi.fn();
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStub: AuthServiceStub;

  beforeEach(() => {
    authStub = new AuthServiceStub();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches Bearer token when present', () => {
    authStub.token.set('abc-123');

    http.get('/api/profile').subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc-123');
    req.flush({});
  });

  it('does not attach Authorization when token is missing', () => {
    authStub.token.set(null);

    http.get('/api/profile').subscribe();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('forwards the response untouched on success', () => {
    authStub.token.set('xyz');

    let received: unknown;
    http.get('/api/profile').subscribe((res) => (received = res));

    const req = httpMock.expectOne('/api/profile');
    req.flush({ id: 1 });
    expect(received).toEqual({ id: 1 });
  });
});
