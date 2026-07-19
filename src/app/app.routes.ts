import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: '/filters', // <-- Redirige forzosamente al login al entrar a la app
      },
      {
        path: 'filters',
        canActivate: [authGuard], // <-- Descomentado y protegido
        loadComponent: () =>
          import('./features/filters/filters.component').then((m) => m.FiltersComponent),
      },
      {
        path: 'assessment',
        canActivate: [authGuard], // <-- Descomentado y protegido
        loadChildren: () =>
          import('./features/assessment/assessment.routes').then((m) => m.assessmentRoutes),
      },
      {
        path: 'careers',
        canActivate: [authGuard], // <-- Protegido
        loadChildren: () =>
          import('./features/careers/careers.routes').then((m) => m.careersRoutes),
      },
      {
        path: 'results',
        canActivate: [authGuard], // <-- Protegido
        loadChildren: () =>
          import('./features/results/results.routes').then((m) => m.resultsRoutes),
      },
      {
        path: 'profile',
        canActivate: [authGuard], // <-- Protegido
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
