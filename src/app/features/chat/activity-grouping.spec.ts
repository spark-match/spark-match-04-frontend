import { ChatActivity } from './chat.model';
import { groupActivities } from './activity-grouping';

function tool(id: string, overrides: Partial<ChatActivity> = {}): ChatActivity {
  return {
    id,
    label: 'Consultando el catálogo de carreras…',
    kind: 'tool',
    running: false,
    reason: 'para describirte la carrera con el catálogo delante y no de memoria',
    ...overrides,
  };
}

describe('groupActivities', () => {
  it('leaves a single call as its own group', () => {
    const groups = groupActivities([tool('tc-1', { detail: '«ingeniería»' })]);

    expect(groups.length).toBe(1);
    expect(groups[0].calls).toEqual([tool('tc-1', { detail: '«ingeniería»' })]);
  });

  it('collapses six consecutive calls to the same tool into one group', () => {
    // El caso real: el coordinador reformuló la misma búsqueda seis veces
    // contra `search_careers` en vez de cambiar de herramienta.
    const calls = ['*', 'ingeniería', 'salud medicina', 'educación', 'derecho', 'artes'].map(
      (q, i) => tool(`tc-${i}`, { detail: `«${q}»` }),
    );

    const groups = groupActivities(calls);

    expect(groups.length).toBe(1);
    expect(groups[0].calls.length).toBe(6);
    expect(groups[0].calls.map((c) => c.detail)).toEqual([
      '«*»',
      '«ingeniería»',
      '«salud medicina»',
      '«educación»',
      '«derecho»',
      '«artes»',
    ]);
  });

  it('does not merge calls to different tools', () => {
    const groups = groupActivities([
      tool('tc-1', { label: 'Buscando en internet…' }),
      tool('tc-2', { label: 'Consultando el catálogo de carreras…' }),
    ]);

    expect(groups.length).toBe(2);
  });

  it('starts a new group when the same tool is used again after something else', () => {
    // Herramienta, delegación, y la misma herramienta otra vez: son dos
    // momentos distintos del turno, no una racha continua.
    const groups = groupActivities([
      tool('tc-1', { label: 'Buscando en internet…' }),
      tool('tc-2', { label: 'Evaluando tu perfil vocacional…', kind: 'subagent' }),
      tool('tc-3', { label: 'Buscando en internet…' }),
    ]);

    expect(groups.length).toBe(3);
    expect(groups[0].calls.length).toBe(1);
    expect(groups[2].calls.length).toBe(1);
  });

  it('keeps two calls to the same label but different kind apart', () => {
    // No debería pasar en la práctica, pero si pasara, mezclar una tool y un
    // subagente bajo un mismo grupo perdería la distinción visual entre
    // ambos (el chip de subagente se pinta distinto a propósito).
    const groups = groupActivities([
      tool('tc-1', { label: 'x', kind: 'tool' }),
      tool('tc-2', { label: 'x', kind: 'subagent' }),
    ]);

    expect(groups.length).toBe(2);
  });

  it('is running if any call in the group is still running', () => {
    const groups = groupActivities([
      tool('tc-1', { running: false }),
      tool('tc-2', { running: true }),
    ]);

    expect(groups[0].running).toBe(true);
  });

  it('is failed if any call in the group failed', () => {
    const groups = groupActivities([tool('tc-1', { ok: true }), tool('tc-2', { ok: false })]);

    expect(groups[0].ok).toBe(false);
  });

  it('takes the reason from whichever call has one', () => {
    // Todas las llamadas a la misma herramienta comparten la misma razón en
    // la práctica, pero por si el primer evento llegara sin ella.
    const groups = groupActivities([
      tool('tc-1', { reason: undefined }),
      tool('tc-2', { reason: 'la razón real' }),
    ]);

    expect(groups[0].reason).toBe('la razón real');
  });

  it('uses the first call id as the group key', () => {
    const groups = groupActivities([tool('tc-1'), tool('tc-2')]);

    expect(groups[0].key).toBe('tc-1');
  });

  it('returns nothing for an empty list', () => {
    expect(groupActivities([])).toEqual([]);
  });
});
