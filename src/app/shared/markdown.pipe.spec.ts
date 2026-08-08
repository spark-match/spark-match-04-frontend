import { TestBed } from '@angular/core/testing';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { MarkdownPipe } from './markdown.pipe';

const pipe = new MarkdownPipe();

describe('MarkdownPipe', () => {
  it('renders bold instead of showing the asterisks', () => {
    // Lo que se veia en dev: "**Opción 1 - Assessment completo:**" tal cual.
    const html = pipe.transform('**Opción 1 - Assessment completo:** Puedo guiarte');

    expect(html).toContain('<strong>Opción 1 - Assessment completo:</strong>');
    expect(html).not.toContain('**');
  });

  it('renders numbered lists as lists', () => {
    const html = pipe.transform('1. Descubrir tu perfil\n2. Recomendarte carreras');

    expect(html).toContain('<ol>');
    expect(html.match(/<li>/g)?.length).toBe(2);
  });

  it('renders bullet lists', () => {
    expect(pipe.transform('- uno\n- dos')).toContain('<ul>');
  });

  it('honours single line breaks, because a chat is not a document', () => {
    expect(pipe.transform('primera línea\nsegunda línea')).toContain('<br>');
  });

  it('returns an empty string for nothing to render', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('leaves an unclosed marker alone mid-stream', () => {
    // Durante el streaming llega "**Opción" antes que su cierre. Debe verse
    // literal y convertirse en negrita cuando llegue el resto, no romper.
    expect(pipe.transform('**Opción 1')).toContain('**Opción 1');
  });
});

describe('MarkdownPipe on the shapes the agent actually emits', () => {
  it('renders a fenced code block as a real block', () => {
    // Lo de la captura: el bloque de codigo salia aplastado en un parrafo.
    const html = pipe.transform('```python\nclass Estudiante:\n    pass\n```');

    expect(html).toContain('<pre>');
    expect(html).toContain('class="language-python"');
    expect(html).not.toContain('```');
  });

  it('renders tables, because career comparisons come as tables', () => {
    const html = pipe.transform('| Carrera | Sueldo |\n|---|---|\n| Sistemas | 3500 |');

    expect(html).toContain('<table>');
    expect(html).toContain('<td>Sistemas</td>');
  });

  it('opens links in a new tab without handing over the opener', () => {
    // El agente saca estos enlaces de una busqueda web: ni el equipo ni el
    // estudiante eligieron el destino.
    const html = pipe.transform('[Ponte en Carrera](https://ponteencarrera.pe)');

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe('MarkdownPipe under Angular sanitization', () => {
  let sanitizer: DomSanitizer;

  beforeEach(() => {
    TestBed.resetTestingModule();
    sanitizer = TestBed.inject(DomSanitizer);
  });

  /** Lo mismo que hace [innerHTML] antes de escribir en el DOM. */
  function throughSanitizer(markdown: string): string {
    return sanitizer.sanitize(SecurityContext.HTML, pipe.transform(markdown)) ?? '';
  }

  it('drops a script tag', () => {
    expect(throughSanitizer('<script>alert(1)</script>')).not.toContain('<script');
  });

  it('drops an inline event handler', () => {
    expect(throughSanitizer('<img src=x onerror="alert(1)">')).not.toContain('onerror');
  });

  it('neutralises a javascript: URL that marked itself lets through', () => {
    // Verificado ejecutando marked: emite <a href="javascript:alert(1)"> sin
    // quejarse. La defensa NO es marked, es el sanitizador de Angular -- por
    // eso se prueba aqui, y por eso el pipe nunca devuelve SafeHtml.
    expect(pipe.transform('[malo](javascript:alert(1))')).toContain('javascript:');

    const sanitized = throughSanitizer('[malo](javascript:alert(1))');

    // Angular no BORRA el esquema: lo prefija con `unsafe:`, de modo que el
    // href deja de ser un esquema que el navegador sepa ejecutar. El texto
    // "javascript:" sigue ahi, inerte. Escrito asi porque la primera version
    // de este test afirmaba que desaparecia, y fallo: la defensa existe, pero
    // no funciona como yo suponia.
    expect(sanitized).toContain('unsafe:');
    expect(sanitized).not.toContain('href="javascript:');
  });

  it('keeps the formatting that matters', () => {
    const html = throughSanitizer('**negrita** y `codigo`\n\n- uno\n- dos');

    expect(html).toContain('<strong>');
    expect(html).toContain('<code>');
    expect(html).toContain('<ul>');
  });
});
