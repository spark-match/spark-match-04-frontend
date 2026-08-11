import { Routes } from '@angular/router';

const chatComponent = () => import('../chat/chat.component').then((m) => m.ChatComponent);

export const assessmentRoutes: Routes = [
  {
    // Sin id: continúa la última conversación (la que guarda ChatService en
    // localStorage) o abre una nueva si no hay ninguna.
    path: '',
    loadComponent: chatComponent,
    title: 'Chat vocacional',
  },
  {
    // Con id: abre esa conversación concreta. Es la URL que usan el sidebar y
    // "+ Nuevo chat", y por eso recargar sobre ella se queda donde estaba en
    // vez de saltar a otro hilo.
    path: ':threadId',
    loadComponent: chatComponent,
    title: 'Chat vocacional',
  },
];
