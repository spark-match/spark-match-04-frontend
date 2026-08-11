import { Routes } from '@angular/router';

export const resultsRoutes: Routes = [
  {
    path: '',
    // Apuntamos a la carpeta de reportes
    loadComponent: () => import('../reports/reports.component').then((m) => m.ReportsComponent),
    title: 'Reportes',
  },
];
