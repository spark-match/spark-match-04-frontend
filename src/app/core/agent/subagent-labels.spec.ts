import { UNKNOWN_SUBAGENT_LABEL, subagentLabel, subagentReason } from './subagent-labels';

describe('subagentLabel', () => {
  it('names each specialist in words a student understands', () => {
    expect(subagentLabel('assessment')).toBe(
      'Subagente especialista evaluando tu perfil vocacional…',
    );
    expect(subagentLabel('matching')).toBe(
      'Subagente especialista buscando carreras que encajen contigo…',
    );
    expect(subagentLabel('planning')).toBe('Subagente especialista armando tu plan de acción…');
  });

  /*
   * `report` faltaba, y era el peor de los cuatro para faltar: emitir el
   * informe es lo mas lento que hace el sistema --10-20 s de modelo mas el
   * render del PDF-- y se anunciaba con el generico de clave desconocida,
   * justo el que no puede explicar por que la espera es larga.
   */
  it('knows the specialist that writes the report', () => {
    expect(subagentLabel('report')).toBe(
      'Subagente especialista redactando tu informe de orientación…',
    );
    expect(subagentLabel('report')).not.toBe(UNKNOWN_SUBAGENT_LABEL);
  });

  /*
   * Las palabras «subagente especialista» son un requisito, no una redaccion.
   * Sin ellas, una delegacion se lee igual que una consulta a una tabla, y lo
   * que separa a las dos es de donde sale lo que el estudiante va a leer y
   * cuanto va a tardar.
   */
  it('says out loud that a specialist subagent is doing the work', () => {
    for (const clave of ['assessment', 'matching', 'planning', 'report', 'desconocido']) {
      expect(subagentLabel(clave).toLowerCase()).toContain('subagente especialista');
    }
    expect(subagentLabel(undefined).toLowerCase()).toContain('subagente especialista');
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
    // El del informe avisa de la espera: es la operacion mas lenta y la unica
    // cuyo resultado no aparece en el chat sino en otra pantalla.
    expect(subagentReason('report')).toContain('guardar y releer');
  });

  it('says nothing rather than inventing a reason', () => {
    // Un motivo generico para un especialista desconocido describiria algo
    // que no es lo que paso.
    expect(subagentReason('orquestador_v3')).toBe('');
    expect(subagentReason(undefined)).toBe('');
  });
});
