/**
 * Traduce los nodos del grafo a algo que un estudiante pueda leer.
 *
 * `STEP_STARTED` trae el nombre interno del nodo — `ContentFilterMiddleware.
 * before_model`, `TodoListMiddleware.after_model` — y esos nombres no se
 * enseñan: no significan nada para quien está preguntando qué estudiar, y
 * varios son pura fontanería del grafo.
 *
 * Asi que se mapea lo que si dice algo y se calla el resto. Un paso sin
 * etiqueta devuelve `null`, y la UI mantiene el mensaje anterior en vez de
 * parpadear a vacio. Eso ademas hace que agregar un middleware nuevo en el
 * agente nunca saque texto raro por pantalla: lo peor que pasa es que ese
 * paso no se anuncie.
 */

const LABELS: { prefix: string; label: string }[] = [
  { prefix: 'model', label: 'Pensando…' },
  { prefix: 'tools', label: 'Buscando información…' },
  { prefix: 'Memory', label: 'Recordando lo que ya sé de ti…' },
  { prefix: 'Skills', label: 'Consultando sus guías…' },
  { prefix: 'Guardrails', label: 'Revisando tu mensaje…' },
  { prefix: 'ContentFilter', label: 'Revisando tu mensaje…' },
  { prefix: 'ProfilePersist', label: 'Anotando lo que aprendí de ti…' },
];

export function stepLabel(stepName: string | undefined): string | null {
  if (!stepName) return null;
  return LABELS.find((entry) => stepName.startsWith(entry.prefix))?.label ?? null;
}

/** Lo que se muestra mientras aún no llegó ningún paso reconocible. */
export const INITIAL_STEP_LABEL = 'Conectando con el orientador…';
