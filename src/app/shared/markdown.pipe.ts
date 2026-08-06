import { Pipe, PipeTransform } from '@angular/core';
import { Marked } from 'marked';

/**
 * Convierte a HTML la respuesta del agente.
 *
 * El agente escribe en markdown — negritas, listas, tablas, bloques de
 * código — y la burbuja lo pintaba con interpolación dentro de un `<p>`, así
 * que el estudiante veía los asteriscos y las comillas triples tal cual, con
 * el código entero aplastado en un solo párrafo.
 *
 * Sobre la seguridad: el HTML que sale de aquí se enlaza con `[innerHTML]`,
 * que en Angular pasa SIEMPRE por `DomSanitizer` en `SecurityContext.HTML`
 * — se van los `<script>`, los `on*` y los `javascript:`. Eso importa más de
 * lo normal aquí, porque el markdown no lo escribe el equipo: lo escribe un
 * modelo, sobre texto que puede haber traído un estudiante, y desde que hay
 * búsqueda web también sobre contenido de páginas de terceros. Por eso este
 * pipe NUNCA devuelve `SafeHtml`: marcarlo como confiable desactivaría
 * exactamente la defensa que hace falta.
 *
 * `breaks: true` porque en un chat un salto de línea es un salto de línea;
 * la regla de markdown de exigir dos espacios al final no tiene sentido para
 * quien está conversando.
 */

/**
 * Instancia propia y no el singleton `marked`.
 *
 * `marked.use()` muta el objeto global del módulo. Con el singleton, este
 * `use` afectaría a cualquier otro punto de la app que importara `marked`, y
 * volver a ejecutarlo (recarga en tests, HMR) apila los renderers en vez de
 * reemplazarlos.
 */
const renderer = new Marked({ breaks: true, gfm: true });

renderer.use({
  renderer: {
    /**
     * Los enlaces del agente salen a sitios que ni el equipo ni el
     * estudiante eligieron — el modelo los saca de una búsqueda web. Van a
     * pestaña nueva para no sacar al estudiante de su conversación, y con
     * `noopener` para que el destino no pueda tocar la ventana de origen.
     */
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${text}</a>`;
    },
  },
});

@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    // `async: false` fuerza la firma síncrona: sin esto el tipo de retorno es
    // `string | Promise<string>` y un pipe no puede resolver una promesa.
    return renderer.parse(value, { async: false });
  }
}
