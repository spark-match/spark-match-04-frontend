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
  calculate_affinity: 'Calculando tu afinidad…',
  evaluate_riasec_profile: 'Evaluando tu perfil vocacional…',
  search_memory: 'Repasando lo que conversamos…',
  manage_prefs: 'Anotando tus preferencias…',
  // `task` es cómo deepagents expone la delegación a un subagente: en el
  // stream no hay ningún evento propio de subagentes, se ve como una tool
  // call normal con este nombre.
  task: 'Consultando a un especialista…',
  write_todos: 'Organizando el plan…',
  write_file: 'Guardando notas…',
  edit_file: 'Actualizando sus notas…',
  read_file: 'Revisando sus notas…',
  ls: 'Revisando sus notas…',
};

/** Lo que se muestra para una herramienta que este mapa no conoce. */
export const UNKNOWN_TOOL_LABEL = 'Usando una herramienta…';

export function toolLabel(toolName: string | undefined): string {
  if (!toolName) return UNKNOWN_TOOL_LABEL;
  return LABELS[toolName] ?? UNKNOWN_TOOL_LABEL;
}
