import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

/**
 * Convierte a HTML la respuesta del agente.
 *
 * El agente escribe en markdown — negritas, listas numeradas, encabezados —
 * y la burbuja lo pintaba con interpolación dentro de un `<p>`, así que el
 * estudiante veía esto tal cual:
 *
 *   **Opción 1 - Assessment completo (recomendado):** Puedo guiarte a través
 *
 * asteriscos incluidos, y la lista aplastada en un solo párrafo.
 *
 * Sobre la seguridad: el HTML que sale de aquí se enlaza con `[innerHTML]`,
 * que en Angular pasa SIEMPRE por `DomSanitizer` en `SecurityContext.HTML`
 * — se van los `<script>`, los `on*` y los `javascript:`. Eso importa más de
 * lo normal aquí, porque el markdown no lo escribe el equipo: lo escribe un
 * modelo, sobre texto que puede haber traído un estudiante. Por eso este
 * pipe NUNCA devuelve `SafeHtml`: marcarlo como confiable desactivaría
 * exactamente la defensa que hace falta.
 *
 * `breaks: true` porque en un chat un salto de línea es un salto de línea;
 * la regla de markdown de exigir dos espacios al final no tiene sentido para
 * quien está conversando.
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    // `async: false` fuerza la firma síncrona: sin esto el tipo de retorno es
    // `string | Promise<string>` y un pipe no puede resolver una promesa.
    return marked.parse(value, { async: false, breaks: true, gfm: true });
  }
}
