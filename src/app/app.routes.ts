import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.page').then((m) => m.LandingPage),
    title: 'Spark Match - Copiloto de Orientación Vocacional'
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.authRoutes)
  },
  {
    path: 'assessment',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/assessment/assessment.routes').then((m) => m.assessmentRoutes)
  },
  {
    path: 'careers',
    loadChildren: () =>
      import('./features/careers/careers.routes').then((m) => m.careersRoutes)
  },
  {
    path: 'results',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/results/results.routes').then((m) => m.resultsRoutes)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/profile.page').then((m) => m.ProfilePage)
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.page').then((m) => m.NotFoundPage)
  }
];
