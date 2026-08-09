/**
 * Cuánto tardó una llamada, o que no pudo completarse.
 *
 * Extraído de `ChatComponent` para que `ActivityListComponent` (el chip
 * agrupado, ver `activity-grouping.ts`) pueda formatear sin depender del
 * componente padre. En `ChatComponent` no queda envoltorio: al pasarle las
 * dos listas al hijo se quedó sin llamadores, y su spec pasó a comprobar que
 * la duración llega al chip — el formato se prueba aquí al lado.
 */
import { ChatActivity } from './chat.model';

export function activityTimingLabel(activity: ChatActivity): string {
  // Vacío mientras corre — un contador subiendo distrae del texto que se
  // está escribiendo — y vacío también para las herramientas normales, que
  // no reportan duración.
  if (activity.running) return '';
  if (activity.ok === false) return ' · no pudo completarse';
  if (activity.durationMs === undefined) return '';
  // Los milisegundos por debajo del segundo se dejan tal cual en vez de
  // redondear a «1 s»: redondear hacia arriba exagera lo que costó.
  return activity.durationMs < 1000
    ? ` · ${activity.durationMs} ms`
    : ` · ${(activity.durationMs / 1000).toFixed(1)} s`;
}
