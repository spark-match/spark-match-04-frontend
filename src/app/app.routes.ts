import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { SECCION_POR_DEFECTO } from './core/title.strategy';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  /*
   * La portada pública. Va ANTES del bloque de `AppLayoutComponent` y con
   * `pathMatch: 'full'`, así que sólo se lleva la raíz: `/home` y compañía
   * siguen cayendo en el layout de la aplicación de abajo.
   *
   * Antes la raíz redirigía a `/home`, que está protegido, o sea que quien
   * llegaba sin cuenta rebotaba al login sin haber visto qué es esto. El
   * producto no se puede explicar desde un formulario de acceso.
   *
   * Fuera del layout a propósito: la barra lateral es la navegación del
   * producto y enseñársela a quien no ha entrado es ofrecerle siete sitios a
   * los que no puede ir.
   */
  {
    path: '',
    pathMatch: 'full',
    title: SECCION_POR_DEFECTO,
    loadComponent: () => import('./features/portada/portada.page').then((m) => m.PortadaPage),
  },
  {
    path: '',
    component: AppLayoutComponent,
    children: [
      {
        path: 'home',
        title: 'Inicio',
        canActivate: [authGuard],
        loadComponent: () => import('./features/landing/landing.page').then((m) => m.LandingPage),
      },
      {
        path: 'filters',
        title: 'Configura tu búsqueda',
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
        title: 'Mi perfil',
        canActivate: [authGuard], // <-- Protegido
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: '**',
    title: 'Página no encontrada',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
