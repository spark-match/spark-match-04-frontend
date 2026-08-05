import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Desenvuelve el sobre estandar del backend.
 *
 * `spark-match-03-backend` responde SIEMPRE con la misma envoltura
 * (`shared/src/http/api-response.ts`):
 *
 *   { success: true,  data: <payload>, meta: { requestId, timestamp } }
 *   { success: false, error: { code, message, details[] }, meta: {...} }
 *
 * Los servicios de esta app tipan el payload plano -- `LoginResponse` es
 * `{ accessToken, expiresIn, user }`, no `{ success, data }`. Sin este
 * interceptor, `AuthService.persistSession` lee `res.accessToken` del cuerpo
 * crudo y guarda `undefined` como token: el login "funciona" (HTTP 200) pero
 * la sesion queda rota.
 *
 * Se desenvuelve solo cuando el cuerpo tiene exactamente la forma del sobre
 * (`success === true` y una clave `data`). Cualquier otra respuesta pasa
 * intacta, para no romper endpoints que no sigan la convencion ni descargas
 * de assets via HttpClient.
 *
 * Los errores no se tocan aca: llegan como HttpErrorResponse y los maneja
 * `errorInterceptor`. El sobre de error queda accesible en `error.error`.
 */
interface SuccessEnvelope {
  success: true;
  data: unknown;
}

function isSuccessEnvelope(body: unknown): body is SuccessEnvelope {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === true &&
    'data' in body
  );
}

export const apiEnvelopeInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event) => {
      if (event instanceof HttpResponse && isSuccessEnvelope(event.body)) {
        return event.clone({ body: event.body.data });
      }
      return event;
    }),
  );
