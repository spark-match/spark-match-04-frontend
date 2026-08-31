import { toolDetail, toolReason } from './tool-details';

describe('toolReason', () => {
  it('explains why the agent goes to the real catalogue', () => {
    expect(toolReason('search_programs')).toContain('existen de verdad');
  });

  it('explains why it searches the internet instead of answering from memory', () => {
    expect(toolReason('web_search')).toContain('cambia con el tiempo');
  });

  it('says nothing about a tool it does not know', () => {
    // Un motivo inventado para una herramienta nueva seria peor que ninguno:
    // el estudiante leeria una explicacion que no corresponde a lo que paso.
    expect(toolReason('herramienta_nueva')).toBe('');
    expect(toolReason(undefined)).toBe('');
  });

  it('leaves the delegation without a reason of its own', () => {
    // Lo contesta `subagent-labels.ts`, que si sabe a que especialista se
    // delego. Aqui `task` son todas las delegaciones a la vez.
    expect(toolReason('task')).toBe('');
  });
});

describe('toolDetail', () => {
  it('says what the agent is actually looking for', () => {
    const detail = toolDetail(
      'search_programs',
      '{"career": "ingeniería", "location": "Áncash", "institution_type": "Universidad"}',
    );

    expect(detail).toBe('«ingeniería» · en Áncash · Universidad');
  });

  it('reads the budget as money and not as a bare number', () => {
    expect(toolDetail('search_programs', '{"max_annual_cost": 5000}')).toBe('hasta S/ 5000 al año');
  });

  it('quotes what was typed into a search', () => {
    expect(toolDetail('web_search', '{"query": "becas Pronabec 2026"}')).toBe(
      '«becas Pronabec 2026»',
    );
  });

  it('never shows the arguments of a tool it does not know', () => {
    // La lista blanca es por herramienta: una herramienta nueva en el agente
    // no puede volcar sus argumentos a la pantalla sin pasar por aqui.
    expect(toolDetail('herramienta_nueva', '{"secreto": "valor"}')).toBe('');
  });

  it('never shows the instruction the coordinator dictates to a specialist', () => {
    // El `description` de una tool call `task` es el prompt interno del
    // coordinador. Viaja por el stream desde siempre; enseñarlo publicaria
    // fontaneria del agente, igual que los eventos RAW que el agente filtra.
    const detail = toolDetail(
      'task',
      '{"subagent_type": "matching", "description": "Busca 5 carreras y devuelve JSON"}',
    );

    expect(detail).toBe('');
  });

  it('ignores fields that are not on the tool list', () => {
    const detail = toolDetail(
      'search_programs',
      '{"career": "derecho", "campo_interno": "no debe verse"}',
    );

    expect(detail).toBe('«derecho»');
    expect(detail).not.toContain('no debe verse');
  });

  it('shows nothing while the model is still dictating the arguments', () => {
    // `TOOL_CALL_ARGS` llega en trozos y un turno puede cortarse a mitad. Un
    // JSON incompleto no es un error: es que todavia no hay nada que contar.
    expect(toolDetail('web_search', '{"query": "carre')).toBe('');
    expect(toolDetail('web_search', '')).toBe('');
  });

  it('survives arguments that are not an object', () => {
    expect(toolDetail('web_search', '["carreras"]')).toBe('');
    expect(toolDetail('web_search', 'null')).toBe('');
    expect(toolDetail('web_search', '"texto suelto"')).toBe('');
  });

  it('does not paint [object Object] when a field is not readable', () => {
    expect(toolDetail('web_search', '{"query": {"raro": true}}')).toBe('');
    expect(toolDetail('search_programs', '{"career": ["a", "b"], "location": "Lima"}')).toBe(
      'en Lima',
    );
  });

  it('flattens a value that spans several lines', () => {
    // El primer renglon del chip es uno solo: un argumento con saltos de
    // linea lo partiria en pedazos por toda la pantalla.
    expect(toolDetail('web_search', '{"query": "becas\\n\\n  Pronabec"}')).toBe('«becas Pronabec»');
  });

  it('cuts an argument that would take over the screen', () => {
    const largo = 'a'.repeat(300);

    const detail = toolDetail('manage_memory', JSON.stringify({ content: largo }));

    expect(detail.length).toBeLessThan(60);
    expect(detail).toContain('…');
  });

  it('cuts the whole detail even when no single field is long', () => {
    // Cortar campo a campo no basta: seis campos cortos suman igual, y el
    // chip acabaria ocupando mas que la respuesta.
    const detail = toolDetail(
      'search_programs',
      JSON.stringify({
        career: 'ingeniería industrial y de sistemas de gestión',
        riasec_profile: 'IRC',
        location: 'Madre de Dios',
        institution_type: 'Universidad',
        management_type: 'Privada',
        max_annual_cost: 12000,
      }),
    );

    expect(detail.length).toBeLessThanOrEqual(96);
    expect(detail.endsWith('…')).toBe(true);
  });

  it('shows nothing when no listed field carries a value', () => {
    expect(toolDetail('search_programs', '{"limit": 8}')).toBe('');
  });
});
