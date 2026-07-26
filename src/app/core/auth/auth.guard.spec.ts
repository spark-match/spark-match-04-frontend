import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

class AuthServiceStub {
  readonly token = signal<string | null>(null);
  isAuthenticated = vi.fn(() => this.token() !== null);
  logout = vi.fn();
}

describe('authGuard', () => {
  let authStub: AuthServiceStub;
  let router: Router;

  beforeEach(() => {
    authStub = new AuthServiceStub();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
      ],
    });

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('allows navigation when the user has a token', () => {
    authStub.token.set('valid-token');

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /auth/login and returns false when no token', () => {
    authStub.token.set(null);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});