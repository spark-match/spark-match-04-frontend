import { ChatActivity } from './chat.model';
import { activityTimingLabel, hayDetalleQueEnsenar } from './activity-timing';

function activity(overrides: Partial<ChatActivity> = {}): ChatActivity {
  return { id: 'tc-1', label: 'x', kind: 'tool', running: false, ...overrides };
}

describe('activityTimingLabel', () => {
  it('is empty while the call is still running', () => {
    // Un contador subiendo distraería del texto que se está escribiendo.
    expect(activityTimingLabel(activity({ running: true, durationMs: 500 }))).toBe('');
  });

  it('says a failed delegation could not be completed', () => {
    expect(activityTimingLabel(activity({ ok: false }))).toBe(' · no pudo completarse');
  });

  it('is empty when there is no duration to report', () => {
    // Las herramientas normales (no subagentes) no traen duración.
    expect(activityTimingLabel(activity())).toBe('');
  });

  it('shows milliseconds as-is below one second', () => {
    expect(activityTimingLabel(activity({ durationMs: 320 }))).toBe(' · 320 ms');
  });

  it('rounds to one decimal in seconds at or above one second', () => {
    expect(activityTimingLabel(activity({ durationMs: 8400 }))).toBe(' · 8.4 s');
  });
});

describe('hayDetalleQueEnsenar', () => {
  /*
   * El desplegable «Ver el detalle de cada llamada» se abría a viñetas en
   * blanco en un caso que se daba de verdad: `write_todos` («Organizando el
   * plan») no publica asunto, y una conversación recargada tampoco tiene
   * duraciones. Con las dos cosas vacías, cada viñeta quedaba sin una sola
   * letra dentro.
   */
  it('no hay nada que enseñar sin asunto ni duración', () => {
    expect(hayDetalleQueEnsenar([activity(), activity({ id: 'tc-2' })])).toBe(false);
  });

  it('el asunto ya es motivo suficiente', () => {
    expect(hayDetalleQueEnsenar([activity({ detail: 'ingeniería' })])).toBe(true);
  });

  it('la duración también, aunque no haya asunto', () => {
    expect(hayDetalleQueEnsenar([activity({ durationMs: 900 })])).toBe(true);
  });

  it('«no pudo completarse» cuenta como algo que enseñar', () => {
    // Es justo lo que no se puede esconder detrás de un desplegable vacío.
    expect(hayDetalleQueEnsenar([activity({ ok: false })])).toBe(true);
  });

  it('basta con que una del grupo tenga algo', () => {
    expect(hayDetalleQueEnsenar([activity(), activity({ id: 'tc-2', detail: 'salud' })])).toBe(true);
  });

  it('un grupo sin llamadas no ofrece desplegable', () => {
    expect(hayDetalleQueEnsenar([])).toBe(false);
  });
});
