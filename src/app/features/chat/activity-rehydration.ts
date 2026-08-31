/**
 * Los chips de una conversación que se vuelve a abrir.
 *
 * Al recargar la página, la respuesta se quedaba sin procedencia: las mismas
 * cifras, y ninguna pista de si salieron del catálogo del MINEDU, de una
 * búsqueda en internet o de un especialista — que es justo lo que decide
 * cuánto fiarse de ellas. El agente ya manda esa información en el historial
 * (`spark-match-07-deep-agent#86`); lo que faltaba era traducirla.
 *
 * ## Traducir, no reimplementar
 *
 * Lo que llega del historial es la misma información que llega por el stream,
 * dicha de otra forma: en vivo son eventos (`TOOL_CALL_START`, luego los
 * argumentos, luego el resultado) y aquí es un resumen ya cerrado. Así que
 * esto no decide nada nuevo — reusa los mismos cuatro mapas que usa el turno
 * en vivo (`tool-labels`, `tool-details`, `subagent-labels`) para que un chip
 * se lea igual antes y después de recargar. Dos tablas de copia que se
 * separan con el tiempo son la forma habitual de que eso deje de cumplirse.
 *
 * ## Aquí nada sigue en curso
 *
 * `running` va siempre en false y no hay duración. Rehidratar es mirar algo
 * que ya pasó: un chip girando en una conversación de hace cuatro días sería
 * mentira. La duración sólo la conoce el turno en vivo, que la cronometra; el
 * historial no la guarda, y no se inventa.
 */
import { showsInActivity, toolKind, toolLabel } from '../../core/agent/tool-labels';
import { subjectDetail, toolReason } from '../../core/agent/tool-details';
import { subagentLabel, subagentReason } from '../../core/agent/subagent-labels';
import { ChatActivity, ThreadActivity } from './chat.model';

/**
 * El historial trae más llamadas de las que se pintan.
 *
 * El agente publica el turno entero, incluidas las herramientas con las que se
 * organiza; cuáles de ellas merecen un chip lo decide `showsInActivity`, el
 * mismo criterio que aplica el turno en vivo. Filtrar aquí y no en el agente es
 * lo que deja que la decisión se pueda cambiar de opinión: el dato sigue
 * guardado en las conversaciones viejas.
 */
export function actividadRehidratada(actividad: ThreadActivity[] | undefined): ChatActivity[] {
  return (actividad ?? []).filter((llamada) => showsInActivity(llamada.tool)).map(unChip);
}

function unChip(llamada: ThreadActivity): ChatActivity {
  const base = {
    id: llamada.id,
    running: false,
    // `null` es «nunca se supo», y eso no es lo mismo que haber fallado: un
    // turno puede cerrarse sin que se anotara el resultado de una llamada.
    // Se deja sin decidir en vez de pintar un fallo que no consta.
    ok: llamada.ok ?? undefined,
  };

  // Una delegación se reconoce por traer especialista, no por el nombre de la
  // herramienta: quién es `task` lo sabe el agente, y ese nombre es suyo.
  if (llamada.subagent) {
    return {
      ...base,
      kind: 'subagent',
      label: subagentLabel(llamada.subagent),
      reason: subagentReason(llamada.subagent),
    };
  }

  return {
    ...base,
    kind: toolKind(llamada.tool),
    label: toolLabel(llamada.tool),
    reason: toolReason(llamada.tool),
    detail: subjectDetail(llamada.tool, llamada.subject),
  };
}
