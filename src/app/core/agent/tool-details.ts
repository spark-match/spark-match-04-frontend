/**
 * Con qué llamó el agente a una herramienta, y para qué le sirve.
 *
 * `tool-labels.ts` sólo contesta «qué herramienta», y siempre con la misma
 * frase: «Buscando en internet…» se lee igual buscando becas que buscando el
 * clima. Aquí están las otras dos piezas:
 *
 * - el DETALLE, que son los argumentos que dictó el modelo. Viajan en
 *   `TOOL_CALL_ARGS` desde el primer día y el frontend los tiraba enteros.
 * - el MOTIVO, una frase fija por herramienta que explica por qué el agente
 *   la usa en vez de responder de memoria.
 *
 * Por qué los argumentos NO se vuelcan tal cual: son texto generado por el
 * modelo. Pueden traer instrucciones internas — el `description` de una
 * delegación es el prompt que el coordinador le dicta al especialista — o
 * campos enormes, como el contenido de un fichero de notas. Así que cada
 * herramienta declara qué campos suyos se pueden enseñar y el resto no llega
 * a pantalla. Es la misma regla que ya seguía el mapa de etiquetas: lo que no
 * está declarado no se publica, y añadir una herramienta al agente nunca
 * filtra sus internals al navegador.
 */

/** Tope por campo: el chip es una pista de lo que está pasando, no el dato. */
const MAX_FIELD = 48;

/** Tope del detalle entero, para que un chip no se coma la pantalla. */
const MAX_DETAIL = 96;

/** Un argumento que sí se puede enseñar, y cómo se lee. */
interface ArgSpec {
  key: string;
  render?: (value: string) => string;
}

interface ToolCopy {
  /** Por qué el agente usa esta herramienta. Vacío si no aporta nada. */
  reason: string;
  /** Argumentos que se muestran, en el orden en que se leen. */
  show?: readonly ArgSpec[];
}

const quoted = (value: string) => `«${value}»`;

const COPY: Record<string, ToolCopy> = {
  search_programs: {
    reason: 'para recomendarte carreras que existen de verdad, con su costo y su duración',
    show: [
      { key: 'career', render: quoted },
      { key: 'riasec_profile', render: (value) => `perfil ${value}` },
      { key: 'location', render: (value) => `en ${value}` },
      { key: 'institution_type' },
      { key: 'management_type' },
      { key: 'max_annual_cost', render: (value) => `hasta S/ ${value} al año` },
    ],
  },
  search_careers: {
    reason: 'para describirte la carrera con el catálogo delante y no de memoria',
    show: [{ key: 'query', render: quoted }],
  },
  web_search: {
    reason: 'porque eso cambia con el tiempo y no está en los datos que trae',
    show: [{ key: 'query', render: quoted }],
  },
  calculate_affinity: {
    reason: 'para ordenar las carreras por lo que encajan contigo',
    show: [{ key: 'riasec_code', render: (value) => `perfil ${value}` }],
  },
  evaluate_riasec_profile: {
    reason: 'para convertir lo que contaste en un perfil vocacional comparable',
  },
  search_memory: {
    reason: 'para no volver a preguntarte algo que ya le contaste',
    show: [{ key: 'query', render: quoted }],
  },
  manage_memory: {
    reason: 'para que la próxima conversación no empiece de cero',
    show: [{ key: 'content', render: quoted }],
  },
  write_todos: {
    reason: 'para no perderse entre las cosas que le pediste',
  },
  // El cuaderno interno del agente. El motivo se puede contar; el contenido
  // no, porque es texto que el modelo escribe para sí mismo.
  write_file: { reason: 'anota lo que va encontrando para no repetir trabajo' },
  edit_file: { reason: 'corrige las notas que tomó en esta conversación' },
  read_file: { reason: 'vuelve sobre lo que ya había anotado' },
  ls: { reason: 'revisa qué notas tiene de esta conversación' },
  glob: { reason: 'revisa qué notas tiene de esta conversación' },
  grep: { reason: 'busca dentro de sus notas de esta conversación' },
  // `task` a propósito sin `show` y sin motivo: su argumento `description` es
  // la instrucción que el coordinador le dicta al especialista, y eso son
  // internals — la misma razón por la que el agente filtra los eventos RAW.
  // Quién contesta el «por qué» es `subagent-labels.ts`, que sabe a cuál se
  // delegó gracias a los eventos `spark.subagent.*`.
  task: { reason: '' },
};

/** Para qué usa el agente esta herramienta. Vacío si no la conoce. */
export function toolReason(toolName: string | undefined): string {
  if (!toolName) return '';
  return COPY[toolName]?.reason ?? '';
}

/**
 * Con qué se llamó a la herramienta, ya listo para pintar.
 *
 * `rawArgs` es el JSON que el modelo dictó en trozos por `TOOL_CALL_ARGS`.
 * Devuelve texto vacío siempre que haya la menor duda: herramienta
 * desconocida, JSON a medias, o ningún campo mostrable con valor.
 */
export function toolDetail(toolName: string | undefined, rawArgs: string): string {
  const show = toolName ? COPY[toolName]?.show : undefined;
  if (!show?.length) return '';

  const args = parseArgs(rawArgs);
  if (!args) return '';

  const parts: string[] = [];
  for (const field of show) {
    const value = readable(args[field.key]);
    if (value) parts.push(field.render ? field.render(value) : value);
  }

  return clamp(parts.join(' · '), MAX_DETAIL);
}

/**
 * El JSON de los argumentos, si está completo.
 *
 * Que no parsee no es un error: el modelo dicta el JSON en trozos y el turno
 * puede cortarse a mitad. Significa que todavía no hay detalle que enseñar.
 */
function parseArgs(rawArgs: string): Record<string, unknown> | null {
  if (!rawArgs.trim()) return null;

  try {
    const parsed: unknown = JSON.parse(rawArgs);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Un valor de los argumentos convertido en algo que una persona pueda leer.
 *
 * Sólo texto y números. Cualquier otra cosa — un objeto, una lista anidada —
 * no se enseña: `String({})` daría «[object Object]», que no informa de nada
 * y ocupa un chip. Los saltos de línea se colapsan porque la primera línea
 * del chip es una sola, y los caracteres de control se quitan para que un
 * argumento no pueda desordenar la pantalla.
 */
function readable(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value !== 'string') return '';

  const flat = [...value.replace(/\s+/g, ' ')]
    .filter((char) => (char.codePointAt(0) ?? 0) >= 32)
    .join('')
    .trim();

  return clamp(flat, MAX_FIELD);
}

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
