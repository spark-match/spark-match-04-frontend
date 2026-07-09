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
    title: 'Iniciar sesión · Spark Match'
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register.page').then((m) => m.RegisterPage),
    title: 'Crear cuenta · Spark Match'
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./pages/forgot-password.page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña · Spark Match'
  }
];
