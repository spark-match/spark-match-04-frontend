import { UNKNOWN_SUBAGENT_LABEL, subagentLabel } from './subagent-labels';

describe('subagentLabel', () => {
  it('names each specialist in words a student understands', () => {
    expect(subagentLabel('assessment')).toBe('Evaluando tu perfil vocacional…');
    expect(subagentLabel('matching')).toBe('Buscando carreras que encajen contigo…');
    expect(subagentLabel('planning')).toBe('Armando tu plan de acción…');
  });

  it('never shows the internal key of a specialist it does not know', () => {
    // Igual que con los nombres de herramienta: agregar un subagente nuevo en
    // el agente no puede sacar su clave interna por pantalla.
    expect(subagentLabel('orquestador_v3')).toBe(UNKNOWN_SUBAGENT_LABEL);
    expect(subagentLabel('orquestador_v3')).not.toContain('orquestador_v3');
  });

  it('falls back when the agent sends no key at all', () => {
    expect(subagentLabel(undefined)).toBe(UNKNOWN_SUBAGENT_LABEL);
    expect(subagentLabel('')).toBe(UNKNOWN_SUBAGENT_LABEL);
  });
});
