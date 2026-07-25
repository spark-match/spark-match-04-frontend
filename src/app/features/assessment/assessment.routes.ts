import { Routes } from '@angular/router';

export const assessmentRoutes: Routes = [
  {
    path: '',
    // Apuntamos directamente a la carpeta de tu chat
    loadComponent: () => import('../chat/chat.component').then((m) => m.ChatComponent),
    title: 'Chat Vocacional · Spark Match',
  },
];
