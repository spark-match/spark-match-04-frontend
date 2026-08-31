/**
 * Cuándo el chat debe seguir al fondo y cuándo tiene que quedarse quieto.
 *
 * Un chat que salta al último mensaje SIEMPRE es tan molesto como uno que no
 * salta nunca: si el estudiante subió a releer una recomendación mientras el
 * agente sigue escribiendo, arrastrarlo abajo le quita de las manos lo que
 * estaba leyendo. La regla que usan los chats que se sienten bien es
 * «pegajoso, no obligatorio»: se sigue el fondo mientras el lector esté ahí, y
 * en cuanto se despega se le deja en paz hasta que él decida volver.
 *
 * Vive suelto y trabajando sobre números en vez de sobre un `HTMLElement` para
 * poder probarlo sin montar el componente ni fabricar un DOM: las tres cifras
 * de abajo son todo lo que hace falta para decidir. En este proyecto eso
 * importa más de lo normal, porque `vi.mock` no funciona con imports relativos
 * en el sistema de tests de Angular y lo que no sea una función pura acaba sin
 * cubrir.
 */

/**
 * Margen dentro del cual se considera que el lector «sigue abajo».
 *
 * No es cero a propósito. Mientras el agente escribe, el texto crece entre un
 * fotograma y el siguiente, así que una comparación exacta daría «despegado»
 * en cuanto llega un token — el contenido creció y el scroll todavía no. Con
 * 120px cabe una línea larga de sobra, que es el salto real entre dos
 * repintados, y el estado no parpadea.
 */
export const MARGEN_DE_FONDO_PX = 120;

/** Lo único que hace falta saber de la caja para decidir. */
export interface CajaDesplazable {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** Píxeles que faltan para llegar abajo del todo. 0 = pegado al fondo. */
export function distanciaAlFondo(caja: CajaDesplazable): number {
  return caja.scrollHeight - caja.clientHeight - caja.scrollTop;
}

/**
 * `true` si el lector está lo bastante abajo como para que seguirle el fondo
 * sea lo que espera.
 *
 * Una caja que no desborda cuenta como pegada: no hay ningún sitio al que
 * despegarse, y tratarla como despegada encendería el botón de «bajar al
 * último» en un chat de dos mensajes.
 *
 * El margen se recorta a la mitad del recorrido disponible, y esto no es un
 * detalle: medido el 2026-08-09 en una conversación cuyo recorrido entero eran
 * 100px, un margen fijo de 120 se lo tragaba completo. Con eso, subir arriba
 * del todo seguía contando como «pegado al fondo», el botón no aparecía nunca
 * y cada mensaje nuevo arrastraba al lector aunque se hubiera subido a releer
 * — justo el comportamiento que este módulo existe para evitar. La proporción
 * mantiene la mitad de arriba como zona de lectura tranquila en cualquier
 * tamaño de conversación.
 */
export function estaPegadoAlFondo(caja: CajaDesplazable, margen = MARGEN_DE_FONDO_PX): boolean {
  const recorrido = caja.scrollHeight - caja.clientHeight;
  return distanciaAlFondo(caja) <= Math.min(margen, recorrido / 2);
}
