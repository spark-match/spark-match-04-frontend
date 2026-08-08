import { UNKNOWN_SUBAGENT_LABEL, subagentLabel, subagentReason } from './subagent-labels';

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

describe('subagentReason', () => {
  it('says what each specialist is there for', () => {
    expect(subagentReason('assessment')).toContain('perfil vocacional');
    expect(subagentReason('matching')).toContain('catálogo real del MINEDU');
    expect(subagentReason('planning')).toContain('pasos concretos');
  });

  it('says nothing rather than inventing a reason', () => {
    // Un motivo generico para un especialista desconocido describiria algo
    // que no es lo que paso.
    expect(subagentReason('orquestador_v3')).toBe('');
    expect(subagentReason(undefined)).toBe('');
  });
});
