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
  // Vive dentro del subagente de report, así que hasta ahora no llegaba nunca
  // aquí: en vivo sí se veía, pero al recargar la página los pasos de dentro
  // de un especialista no estaban en el historial. Desde
  // spark-match-08-deep-agent#105 sí, y sin etiqueta se anunciaba como
  // «Usando una herramienta…» justo en el paso que produce el informe.
  publish_orientation_report: 'Redactando tu informe de orientación…',
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

/**
 * Las herramientas con las que el agente se organiza, no con las que trabaja.
 *
 * `write_todos` es la lista de tareas interna de deepagents, y el resto es su
 * cuaderno de notas: ficheros que escribe y relee dentro de la conversación
 * para no repetir trabajo. Ninguna de las dos cosas le dice nada al estudiante
 * sobre su orientación.
 *
 * Medido en dev el 2026-08-11, en un turno que emitió un informe: de las ocho
 * llamadas, CINCO fueron `write_todos`. Tres chips de «Organizando el plan…»
 * rodeando a los dos que contaban algo, y el último caía DESPUÉS de «Redactando
 * tu informe…» —era el subagente tachando la tarea—, que se lee como si hubiera
 * terminado y hubiera vuelto a empezar.
 *
 * Se filtra aquí y no en el agente a propósito. El agente sigue publicando sus
 * pasos: guardar de más es reversible y si algún día se decide enseñarlos el
 * dato estará; haberlos tirado en el origen no se arregla para las
 * conversaciones ya guardadas. Qué de eso llega a pantalla es una decisión de
 * la interfaz, igual que el resto de la copia de este fichero.
 */
const HERRAMIENTAS_DE_TRAMITE = new Set([
  'write_todos',
  'write_file',
  'edit_file',
  'read_file',
  'ls',
  'glob',
  'grep',
]);

/**
 * Si esta herramienta merece un chip.
 *
 * Las de trámite conservan su etiqueta en `LABELS` a propósito: esto decide si
 * se pinta, no cómo se llama. Si mañana se quiere enseñar alguna, basta con
 * sacarla de la lista de arriba y su copia sigue escrita.
 */
export function showsInActivity(toolName: string | undefined): boolean {
  return !HERRAMIENTAS_DE_TRAMITE.has(toolName ?? '');
}

/** Nombres con etiqueta propia. Para el test de cobertura contra el agente. */
export function labelledToolNames(): string[] {
  return Object.keys(LABELS);
}
