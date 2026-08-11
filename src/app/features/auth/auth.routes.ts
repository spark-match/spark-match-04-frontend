import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login.page').then((m) => m.LoginPage),
    title: 'Inicio de sesión'
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register.page').then((m) => m.RegisterPage),
    title: 'Crear cuenta'
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña'
  }
];
