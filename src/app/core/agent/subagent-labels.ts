/**
 * Traduce la clave del subagente a lo que el estudiante debería leer.
 *
 * El agente delega en tres especialistas y hasta ahora los tres se veían
 * igual: una tool call llamada `task`, que `tool-labels.ts` traducía a un
 * genérico «Consultando a un especialista…». Desde `docs/ag-ui-events.md`
 * del repositorio del agente llegan dos eventos `CUSTOM` que sí dicen a
 * cuál se delegó.
 *
 * Por qué la copia vive aquí y no en el agente: lo que viaja por el stream
 * es un identificador estable, no un texto. Qué lee el estudiante es
 * decisión de la interfaz, y cambiarlo no debería obligar a desplegar el
 * agente. Misma regla que ya seguía `tool-labels.ts`, y con la misma
 * consecuencia útil: una clave desconocida se anuncia genéricamente en vez
 * de sacar por pantalla el nombre interno de un subagente nuevo.
 */

/**
 * Las cuatro etiquetas dicen literalmente «subagente especialista».
 *
 * Antes decían sólo lo que se estaba haciendo — «Evaluando tu perfil
 * vocacional…» —, y eso se confundía con una herramienta cualquiera: el
 * estudiante no tenía forma de saber que detrás había otro agente razonando,
 * no una consulta a una tabla. La distinción importa porque cambia cuánto
 * tarda y de dónde sale lo que va a leer.
 *
 * `report` faltaba, y no era inocuo: el subagente que emite el informe --lo
 * más caro que hace el sistema, 10-20 s de modelo más el PDF-- se anunciaba
 * con el genérico de clave desconocida. Justo el que más necesita explicar
 * por qué la espera es larga.
 */
const LABELS: Record<string, string> = {
  assessment: 'Subagente especialista evaluando tu perfil vocacional…',
  matching: 'Subagente especialista buscando carreras que encajen contigo…',
  planning: 'Subagente especialista armando tu plan de acción…',
  report: 'Subagente especialista redactando tu informe de orientación…',
};

/**
 * Por qué el coordinador delegó, en una frase.
 *
 * El «con qué» de una delegación NO se enseña, aunque viaje: los argumentos
 * de la tool call `task` incluyen un `description` que es la instrucción
 * interna que el coordinador le dicta al especialista, y eso es fontanería
 * del agente, no algo escrito para el estudiante. Lo que sí se puede contar
 * es a qué se dedica cada especialista.
 */
const REASONS: Record<string, string> = {
  assessment: 'un especialista convierte lo que cuentas en un perfil vocacional',
  matching: 'un especialista cruza ese perfil con el catálogo real del MINEDU',
  planning: 'un especialista arma los pasos concretos para llegar a esa carrera',
  // Se avisa de la espera a propósito: es la operación más lenta del producto
  // y la única cuyo resultado no aparece en el chat, sino en otra pantalla.
  report: 'un especialista redacta el documento que podrás guardar y releer; tarda un poco más',
};

/** Lo que se muestra para un subagente que este mapa no conoce. */
export const UNKNOWN_SUBAGENT_LABEL = 'Subagente especialista trabajando…';

export function subagentLabel(subagent: string | undefined): string {
  if (!subagent) return UNKNOWN_SUBAGENT_LABEL;
  return LABELS[subagent] ?? UNKNOWN_SUBAGENT_LABEL;
}

/** Vacío para un especialista desconocido: mejor sin motivo que uno inventado. */
export function subagentReason(subagent: string | undefined): string {
  if (!subagent) return '';
  return REASONS[subagent] ?? '';
}

/** Nombres de los eventos propios del agente (`docs/ag-ui-events.md`). */
export const SUBAGENT_START_EVENT = 'spark.subagent.start';
export const SUBAGENT_END_EVENT = 'spark.subagent.end';
