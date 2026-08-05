import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { apiEnvelopeInterceptor } from './api-envelope.interceptor';

describe('apiEnvelopeInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiEnvelopeInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** El caso que rompia el login contra el backend real. */
  it('unwraps data from the standard success envelope', () => {
    let body: unknown;
    http.post('/v1/auth/login', {}).subscribe((res) => (body = res));

    httpMock.expectOne('/v1/auth/login').flush({
      success: true,
      data: { accessToken: 'jwt-abc', expiresIn: 86400, user: { id: 'u-1' } },
      meta: { requestId: 'req-1', timestamp: '2026-08-05T00:00:00.000Z' },
    });

    expect(body).toEqual({
      accessToken: 'jwt-abc',
      expiresIn: 86400,
      user: { id: 'u-1' },
    });
  });

  it('unwraps arrays and primitives inside data', () => {
    let body: unknown;
    http.get('/v1/users').subscribe((res) => (body = res));

    httpMock.expectOne('/v1/users').flush({
      success: true,
      data: { users: [{ id: 'u-1' }, { id: 'u-2' }] },
      meta: { requestId: 'req-2', timestamp: '2026-08-05T00:00:00.000Z' },
    });

    expect(body).toEqual({ users: [{ id: 'u-1' }, { id: 'u-2' }] });
  });

  it('leaves a non-enveloped body untouched', () => {
    let body: unknown;
    http.get('/assets/config.json').subscribe((res) => (body = res));

    httpMock.expectOne('/assets/config.json').flush({ featureFlag: true });

    expect(body).toEqual({ featureFlag: true });
  });

  it('does not unwrap when success is not exactly true', () => {
    let body: unknown;
    http.get('/v1/thing').subscribe((res) => (body = res));

    const raw = { success: 'true', data: { nested: 1 } };
    httpMock.expectOne('/v1/thing').flush(raw);

    expect(body).toEqual(raw);
  });

  it('does not unwrap when the data key is absent', () => {
    let body: unknown;
    http.get('/v1/ping').subscribe((res) => (body = res));

    const raw = { success: true, meta: { requestId: 'req-3' } };
    httpMock.expectOne('/v1/ping').flush(raw);

    expect(body).toEqual(raw);
  });

  /** El sobre de error viaja en HttpErrorResponse.error y lo maneja errorInterceptor. */
  it('leaves error envelopes to the error channel', () => {
    let errorBody: unknown;
    http.get('/v1/users/me').subscribe({
      next: () => undefined,
      error: (err) => (errorBody = err.error),
    });

    const envelope = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'no token', details: [] },
      meta: { requestId: 'req-4' },
    };
    httpMock
      .expectOne('/v1/users/me')
      .flush(envelope, { status: 401, statusText: 'Unauthorized' });

    expect(errorBody).toEqual(envelope);
  });
});
