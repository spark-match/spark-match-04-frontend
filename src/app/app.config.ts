import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { SparkMatchTitleStrategy } from './core/title.strategy';
import { authInterceptor } from './core/auth/auth.interceptor';
import { apiEnvelopeInterceptor } from './core/http/api-envelope.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Manejo de errores y detección de cambios ultra rápida (Zoneless)
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),

    // Rutas con transiciones suaves
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),

    // La estrategia propia pone título en cada una de las navegaciones; la de
    // Angular sólo lo hace cuando la ruta declara uno, y deja el anterior
    // puesto cuando no. Ver `core/title.strategy.ts`.
    { provide: TitleStrategy, useClass: SparkMatchTitleStrategy },

    // Cliente HTTP con los interceptores necesarios.
    // apiEnvelopeInterceptor va ultimo a proposito: es el mas cercano a la red,
    // asi desenvuelve el sobre { success, data, meta } del backend antes de que
    // los otros interceptores (y los servicios) vean el cuerpo.
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor, apiEnvelopeInterceptor]),
    ),
  ],
};
