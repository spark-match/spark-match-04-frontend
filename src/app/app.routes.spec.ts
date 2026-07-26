import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

describe('app.routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('registers 3 top-level routes (auth, layout, wildcard)', () => {
    expect(routes.length).toBe(3);
    expect(routes[0].path).toBe('auth');
    expect(routes[1].path).toBe('');
    expect(routes[2].path).toBe('**');
  });

  it('mounts AppLayoutComponent under the empty path', () => {
    expect((routes[1] as { component: unknown }).component).toBeTruthy();
  });

  it('exposes the 6 protected feature children under the layout', () => {
    const children = (routes[1] as { children: { path: string }[] }).children;
    const paths = children.map((c) => c.path);

    expect(paths).toEqual(
      expect.arrayContaining([
        '',
        'home',
        'filters',
        'assessment',
        'careers',
        'results',
        'profile',
      ]),
    );
    expect(paths.length).toBe(7);
  });

  it('redirects the empty child to /home with full match', () => {
    const empty = (routes[1] as { children: { path: string; redirectTo?: string; pathMatch?: string }[] })
      .children.find((c) => c.path === '')!;

    expect(empty.redirectTo).toBe('/home');
    expect(empty.pathMatch).toBe('full');
  });

  it('protects the 5 gated features with authGuard', () => {
    const children = (routes[1] as { children: { path: string; canActivate?: unknown[] }[] }).children;
    const protectedPaths = ['home', 'filters', 'assessment', 'careers', 'results', 'profile'];

    for (const path of protectedPaths) {
      const child = children.find((c) => c.path === path)!;
      expect(child.canActivate, `${path} should have canActivate`).toBeTruthy();
    }
  });
});