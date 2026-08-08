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
