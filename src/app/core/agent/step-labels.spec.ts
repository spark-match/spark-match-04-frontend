import { stepLabel } from './step-labels';

describe('stepLabel', () => {
  it('translates the model step', () => {
    expect(stepLabel('model')).toBe('Pensando…');
  });

  it('translates middleware steps a student can make sense of', () => {
    expect(stepLabel('MemoryMiddleware.before_agent')).toBe('Recordando lo que ya sé de ti…');
    expect(stepLabel('ContentFilterMiddleware.before_model')).toBe('Revisando tu mensaje…');
  });

  it('stays quiet on plumbing steps', () => {
    // Nombres reales de un turno en dev. Ninguno significa nada para quien
    // está preguntando qué estudiar.
    expect(stepLabel('TodoListMiddleware.after_model')).toBeNull();
    expect(stepLabel('PatchToolCallsMiddleware.before_agent')).toBeNull();
    expect(stepLabel('MaxTurnsMiddleware.after_model')).toBeNull();
  });

  it('stays quiet on an unknown step instead of inventing a label', () => {
    // Agregar un middleware nuevo en el agente no debe sacar texto raro por
    // pantalla; lo peor que puede pasar es que ese paso no se anuncie.
    expect(stepLabel('AlgoQueTodaviaNoExiste.before_model')).toBeNull();
  });

  it('handles a missing step name', () => {
    expect(stepLabel(undefined)).toBeNull();
  });
});
