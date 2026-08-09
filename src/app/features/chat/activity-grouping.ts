/**
 * Agrupa llamadas repetidas a la misma herramienta en un solo chip.
 *
 * Medido en dev el 2026-08-09: para "qué carreras tienes en tu base de
 * datos", el coordinador llamó a `search_careers` seis veces seguidas con
 * consultas distintas («*», «ingeniería», «salud medicina», …). Sin agrupar,
 * eso son seis `<li>` casi idénticos — mismo label, misma razón repetida seis
 * veces — que empujan la respuesta fuera de la pantalla. ChatGPT y Claude no
 * pintan una línea por llamada: colapsan en una entrada por herramienta con
 * un contador, y el detalle de cada llamada queda detrás de un desplegable.
 *
 * Se agrupa por rachas CONSECUTIVAS del mismo `label` + `kind`, no
 * globalmente: si el agente usa una herramienta, delega, y vuelve a usar la
 * misma herramienta, son dos momentos distintos del turno y se leen mejor
 * como dos grupos que como uno solo con un hueco en medio.
 */
import { ChatActivity, ChatActivityKind } from './chat.model';

export interface ActivityGroup {
  /** Id de la primera llamada del grupo. Estable para `@for track`. */
  key: string;
  label: string;
  kind: ChatActivityKind;
  /** Alguna llamada del grupo sigue en curso. */
  running: boolean;
  /** `false` si alguna llamada del grupo falló. */
  ok?: boolean;
  /** Por qué, una vez por grupo — no tiene sentido repetirlo por llamada. */
  reason?: string;
  /** Las llamadas individuales, en orden. Un solo elemento en el caso común. */
  calls: ChatActivity[];
}

export function groupActivities(activities: ChatActivity[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  for (const activity of activities) {
    const current = groups.at(-1);

    // La condición va invertida y con `current?.` en vez de
    // `current && current.label === …`: no haber grupo previo rompe la racha
    // igual que romperla por label, así que los dos casos comparten rama. De
    // paso evita el acceso encadenado que SonarCloud marca (S6582).
    if (current?.label !== activity.label || current.kind !== activity.kind) {
      groups.push({
        key: activity.id,
        label: activity.label,
        kind: activity.kind,
        running: activity.running,
        ok: activity.ok,
        reason: activity.reason,
        calls: [activity],
      });
      continue;
    }

    current.calls.push(activity);
    current.running = current.running || activity.running;
    if (activity.ok === false) current.ok = false;
    if (!current.reason && activity.reason) current.reason = activity.reason;
  }

  return groups;
}
