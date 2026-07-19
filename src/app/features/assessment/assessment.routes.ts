import { Routes } from '@angular/router';

export const assessmentRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/assessment.page').then((m) => m.AssessmentPage),
    title: 'Cuestionario · Spark Match'
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/assessment-detail.page').then((m) => m.AssessmentDetailPage)
  }
];
