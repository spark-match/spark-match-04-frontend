import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Manejo de errores y detección de cambios ultra rápida (Zoneless)
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),

    // Rutas con transiciones suaves
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),

    // Cliente HTTP con los interceptores necesarios
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
