import { Routes } from '@angular/router';

export const resultsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/results.page').then((m) => m.ResultsPage),
    title: 'Mis resultados · Spark Match'
  }
];
