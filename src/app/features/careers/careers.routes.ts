import { Routes } from '@angular/router';

export const careersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/careers-list.page').then((m) => m.CareersListPage),
    title: 'Carreras · Spark Match'
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/career-detail.page').then((m) => m.CareerDetailPage)
  }
];
