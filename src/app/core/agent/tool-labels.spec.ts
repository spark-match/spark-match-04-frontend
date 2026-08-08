import { UNKNOWN_TOOL_LABEL, toolLabel } from './tool-labels';

describe('toolLabel', () => {
  it('says what a web search is in plain words', () => {
    expect(toolLabel('web_search')).toBe('Buscando en internet…');
  });

  it('translates the vocational tools', () => {
    expect(toolLabel('search_careers')).toBe('Consultando el catálogo de carreras…');
    expect(toolLabel('evaluate_riasec_profile')).toBe('Evaluando tu perfil vocacional…');
    expect(toolLabel('calculate_affinity')).toBe('Calculando tu afinidad…');
  });

  it('tells the real catalogue apart from the generic one', () => {
    // Son dos herramientas distintas y hacen cosas distintas: una describe la
    // carrera, la otra dice en qué universidad se estudia y cuánto cuesta.
    expect(toolLabel('search_programs')).toBe('Buscando carreras en universidades e institutos…');
    expect(toolLabel('search_programs')).not.toBe(toolLabel('search_careers'));
  });

  it('has a label for every tool the agent can actually call', () => {
    // El inventario real está en `src/agent/factory.py` del agente, más las
    // que registra deepagents. Este test existe porque `search_programs` se
    // añadió allí y no aquí, y el chip quedó anunciándose como «Usando una
    // herramienta…» en producción sin que fallara nada.
    const inventory = [
      // Propias del agente (`create_deep_agent(tools=[...])`).
      'evaluate_riasec_profile',
      'search_careers',
      'search_programs',
      'calculate_affinity',
      'web_search',
      // De langmem: el nombre que viaja es el de la librería, no el de la
      // variable de Python.
      'manage_memory',
      'search_memory',
      // Registradas por deepagents. `execute` no está: el middleware la
      // filtra antes de cada llamada al modelo, así que nunca llega a viajar.
      'task',
      'write_todos',
      'ls',
      'read_file',
      'write_file',
      'edit_file',
      'glob',
      'grep',
    ];

    const sinEtiqueta = inventory.filter((tool) => toolLabel(tool) === UNKNOWN_TOOL_LABEL);

    expect(sinEtiqueta).toEqual([]);
  });

  it('treats subagent delegation as what it looks like to a student', () => {
    // ag_ui_langgraph no emite eventos de subagente: deepagents expone la
    // delegación como una tool call normal llamada `task`.
    expect(toolLabel('task')).toBe('Consultando a un especialista…');
  });

  it('never leaks the name of a tool it does not know', () => {
    // Mostrar el nombre crudo publicaría el inventario interno de
    // herramientas del agente a cualquiera que abra el chat.
    const label = toolLabel('herramienta_interna_secreta');

    expect(label).toBe(UNKNOWN_TOOL_LABEL);
    expect(label).not.toContain('herramienta_interna_secreta');
  });

  it('handles a missing tool name', () => {
    expect(toolLabel(undefined)).toBe(UNKNOWN_TOOL_LABEL);
    expect(toolLabel('')).toBe(UNKNOWN_TOOL_LABEL);
  });
});
