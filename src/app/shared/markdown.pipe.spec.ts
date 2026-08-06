import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  const pipe = new MarkdownPipe();

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
    const html = pipe.transform('primera línea\nsegunda línea');

    expect(html).toContain('<br>');
  });

  it('returns an empty string for nothing to render', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('leaves an unclosed marker alone mid-stream', () => {
    // Durante el streaming llega "**Opción" antes que su cierre. Debe verse
    // literal y convertirse en negrita cuando llegue el resto, no romper.
    const html = pipe.transform('**Opción 1');

    expect(html).toContain('**Opción 1');
  });

  it('returns a plain string, never SafeHtml', () => {
    // El HTML se enlaza con [innerHTML], que pasa por DomSanitizer. Devolver
    // SafeHtml apagaria esa defensa, y aqui importa: el markdown lo escribe
    // un modelo sobre texto que pudo traer un estudiante.
    const html = pipe.transform('<script>alert(1)</script>');

    expect(typeof html).toBe('string');
  });
});
