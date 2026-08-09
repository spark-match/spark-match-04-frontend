/**
 * Traduce los nombres de las herramientas a lo que el estudiante debería leer.
 *
 * `TOOL_CALL_START` trae `toolCallName` con el nombre de la función en el
 * agente: `search_careers`, `evaluate_riasec_profile`, `task`. Igual que con
 * los pasos del grafo, esos nombres no se enseñan — y aquí hay una razón
 * extra: enseñarlos publica el inventario interno de herramientas del agente
 * a cualquiera que abra el chat.
 *
 * Una herramienta desconocida no se anuncia con su nombre técnico: se
 * anuncia genéricamente. Así, añadir una herramienta nueva en el agente no
 * filtra su nombre al navegador ni saca texto raro por pantalla.
 */

const LABELS: Record<string, string> = {
  web_search: 'Buscando en internet…',
  search_careers: 'Consultando el catálogo de carreras…',
  // El catálogo real del MINEDU: carreras concretas en universidades e
  // institutos, con costo y duración. `search_careers` describe la carrera en
  // abstracto y no sabe nada de instituciones, así que son dos chips
  // distintos y el estudiante tiene que poder distinguirlos.
  search_programs: 'Buscando carreras en universidades e institutos…',
  calculate_affinity: 'Calculando tu afinidad…',
  // Llegó con el motor multicriterio (spark-match-08-deep-agent#81) y se
  // quedó sin etiqueta hasta el 2026-08-09: la herramienta que más trabajo
  // hace se anunciaba como «Usando una herramienta…». De ahí el test de
  // cobertura que hay al lado de este mapa.
  recommend_programs: 'Buscando los programas que mejor te encajan…',
  evaluate_riasec_profile: 'Evaluando tu perfil vocacional…',
  search_memory: 'Repasando lo que conversamos…',
  // `manage_memory` y no `manage_prefs`: ese último es sólo el nombre de la
  // variable de Python en `factory.py` del agente. La herramienta la
  // construye langmem con `create_manage_memory_tool(...)` sin pasarle
  // `name=`, así que lo que viaja en `toolCallName` es el nombre por defecto
  // de la librería. Con la clave equivocada, anotar una preferencia se
  // anunciaba como «Usando una herramienta…».
  manage_memory: 'Anotando tus preferencias…',
  // `task` es cómo deepagents expone la delegación a un subagente. Desde que
  // el agente emite los eventos `spark.subagent.*` este chip se reemplaza
  // por el del especialista concreto (ver `subagent-labels.ts`); queda como
  // red de seguridad para un agente que aún no los emita.
  task: 'Consultando a un especialista…',
  write_todos: 'Organizando el plan…',
  write_file: 'Guardando notas…',
  edit_file: 'Actualizando sus notas…',
  read_file: 'Revisando sus notas…',
  ls: 'Revisando sus notas…',
  glob: 'Revisando sus notas…',
  grep: 'Revisando sus notas…',
};

/** Lo que se muestra para una herramienta que este mapa no conoce. */
export const UNKNOWN_TOOL_LABEL = 'Usando una herramienta…';

export function toolLabel(toolName: string | undefined): string {
  if (!toolName) return UNKNOWN_TOOL_LABEL;
  return LABELS[toolName] ?? UNKNOWN_TOOL_LABEL;
}

/**
 * Las herramientas que salen a internet.
 *
 * Distinguirlas no es decoración. Todo lo demás que hace el agente sale de un
 * dataset fechado del MINEDU que podemos citar; esto sale de la web de hoy,
 * que nadie ha revisado. Que el estudiante pueda ver de un vistazo cuál de las
 * dos cosas está leyendo es una cuestión de cuánto fiarse del dato, y por eso
 * se le da tratamiento propio en vez de mezclarlo con las demás herramientas.
 */
const HERRAMIENTAS_DE_INTERNET = new Set(['web_search']);

/**
 * Qué clase de chip le toca a una herramienta.
 *
 * `subagent` no sale de aquí: lo decide `subagent-labels.ts` cuando llega un
 * evento `spark.subagent.*`, que asciende el chip genérico de la tool `task`.
 */
export function toolKind(toolName: string | undefined): 'search' | 'tool' {
  return toolName && HERRAMIENTAS_DE_INTERNET.has(toolName) ? 'search' : 'tool';
}

/** Nombres con etiqueta propia. Para el test de cobertura contra el agente. */
export function labelledToolNames(): string[] {
  return Object.keys(LABELS);
}
