import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../auth/auth.service';

class AuthServiceStub {
  logout = vi.fn();
}

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStub: AuthServiceStub;

  beforeEach(() => {
    authStub = new AuthServiceStub();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'auth/login', children: [] }]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('logs out and redirects on 401', () => {
    let receivedStatus = 0;
    http.get('/api/protected').subscribe({
      next: () => undefined,
      error: (err) => (receivedStatus = err.status),
    });

    const req = httpMock.expectOne('/api/protected');
    req.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(receivedStatus).toBe(401);
    expect(authStub.logout).toHaveBeenCalled();
  });

  it('passes through non-401 errors without logging out', () => {
    let receivedStatus = 0;
    http.get('/api/broken').subscribe({
      next: () => undefined,
      error: (err) => (receivedStatus = err.status),
    });

    const req = httpMock.expectOne('/api/broken');
    req.flush({ message: 'Server error' }, { status: 500, statusText: 'Server Error' });

    expect(receivedStatus).toBe(500);
    expect(authStub.logout).not.toHaveBeenCalled();
  });
});
