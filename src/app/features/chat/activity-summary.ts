/**
 * La línea que resume un turno cuando los chips van plegados.
 *
 * Tiene que decir dos cosas en un renglón: **qué** hizo el agente y **cuánto**
 * hizo. Lo primero se cuenta con el chip más significativo del turno y lo
 * segundo con el número de pasos, porque son las dos preguntas que se hace
 * quien mira la procedencia de una respuesta: «¿de dónde salió esto?» y
 * «¿miró poco o miró mucho?».
 *
 * Función suelta y pura para poder probarla sin montar el componente: en este
 * repo `vi.mock` no funciona con imports relativos, así que lo que no se
 * extrae acaba sin cubrir.
 */
import { ActivityGroup } from './activity-grouping';

/**
 * Qué chip representa mejor el turno.
 *
 * El orden no es arbitrario. Una delegación en un especialista es el hecho más
 * gordo que puede pasar en un turno; una búsqueda en internet es lo que más
 * cambia cuánto fiarse de la respuesta; y el resto son consultas al catálogo,
 * que es el caso corriente. Se elige el primero que aparezca de cada clase.
 */
const PRIORIDAD: readonly ActivityGroup['kind'][] = ['subagent', 'search', 'tool'];

function grupoRepresentativo(grupos: ActivityGroup[]): ActivityGroup | undefined {
  for (const kind of PRIORIDAD) {
    const encontrado = grupos.find((grupo) => grupo.kind === kind);
    if (encontrado) return encontrado;
  }
  return grupos[0];
}

/** Pasos de verdad: un grupo de seis llamadas son seis pasos, no uno. */
export function contarPasos(grupos: ActivityGroup[]): number {
  return grupos.reduce((total, grupo) => total + grupo.calls.length, 0);
}

export interface ResumenDeActividad {
  /** El chip que da nombre al turno, con sus puntos suspensivos quitados. */
  titulo: string;
  /** Cuántos pasos hubo en total. */
  pasos: number;
  /** `false` si alguno falló, para que el resumen no lo esconda. */
  ok: boolean;
}

/**
 * La etiqueta de un chip está escrita en gerundio y con puntos suspensivos
 * («Buscando en internet…») porque nace mientras la cosa ocurre. En el resumen
 * ya terminó, así que se le quitan: dejarlos haría creer que sigue corriendo.
 */
function sinPuntosSuspensivos(etiqueta: string): string {
  return etiqueta.replace(/…$/, '').replace(/\.\.\.$/, '');
}

export function resumenDeActividad(grupos: ActivityGroup[]): ResumenDeActividad | null {
  if (!grupos.length) return null;

  const principal = grupoRepresentativo(grupos);
  return {
    titulo: sinPuntosSuspensivos(principal?.label ?? ''),
    pasos: contarPasos(grupos),
    // Un fallo no se pliega en silencio: si algo salió mal, el resumen tiene
    // que poder decirlo sin que haya que abrir el detalle para enterarse.
    ok: grupos.every((grupo) => grupo.ok !== false),
  };
}
