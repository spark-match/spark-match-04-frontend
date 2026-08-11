import { describe, expect, it } from 'vitest';
import { actividadRehidratada } from './activity-rehydration';
import { ThreadActivity } from './chat.model';
import { subjectDetail, toolDetail } from '../../core/agent/tool-details';
import { UNKNOWN_TOOL_LABEL } from '../../core/agent/tool-labels';
import { UNKNOWN_SUBAGENT_LABEL } from '../../core/agent/subagent-labels';

function llamada(extra: Partial<ThreadActivity> = {}): ThreadActivity {
  return { id: 'tc1', tool: 'search_careers', ok: true, ...extra };
}

describe('actividadRehidratada', () => {
  it('sin actividad no inventa chips', () => {
    expect(actividadRehidratada(undefined)).toEqual([]);
    expect(actividadRehidratada([])).toEqual([]);
  });

  it('traduce el nombre de la herramienta y nunca lo deja pasar crudo', () => {
    const [chip] = actividadRehidratada([llamada({ tool: 'search_careers' })]);

    expect(chip.label).toBe('Consultando el catálogo de carreras…');
    expect(chip.label).not.toContain('search_careers');
  });

  it('una herramienta que la interfaz no conoce se anuncia genéricamente', () => {
    const [chip] = actividadRehidratada([llamada({ tool: 'herramienta_secreta_v2' })]);

    expect(chip.label).toBe(UNKNOWN_TOOL_LABEL);
    expect(chip.label).not.toContain('herramienta_secreta_v2');
  });

  it('enseña con qué se llamó', () => {
    const [chip] = actividadRehidratada([llamada({ subject: 'ingeniería' })]);

    expect(chip.detail).toBe('«ingeniería»');
  });

  it('una llamada sin asunto se queda sin detalle, no con uno vacío raro', () => {
    const [chip] = actividadRehidratada([llamada({ tool: 'manage_memory' })]);

    expect(chip.detail).toBe('');
  });

  it('separa la búsqueda en internet del resto, que es de lo que va la distinción', () => {
    const [web] = actividadRehidratada([llamada({ tool: 'web_search', subject: 'becas' })]);
    const [catalogo] = actividadRehidratada([llamada({ tool: 'search_careers' })]);

    expect(web.kind).toBe('search');
    expect(catalogo.kind).toBe('tool');
  });

  describe('delegaciones', () => {
    it('dice a qué especialista se llamó, no «un especialista»', () => {
      const chips = actividadRehidratada([
        { id: 'tc1', tool: 'task', ok: true, subagent: 'assessment' },
        { id: 'tc2', tool: 'task', ok: true, subagent: 'matching' },
      ]);

      expect(chips.map((c) => c.label)).toEqual([
        'Subagente especialista evaluando tu perfil vocacional…',
        'Subagente especialista buscando carreras que encajen contigo…',
      ]);
      expect(chips.every((c) => c.kind === 'subagent')).toBe(true);
    });

    it('un especialista desconocido no filtra su clave interna', () => {
      const [chip] = actividadRehidratada([
        { id: 'tc1', tool: 'task', ok: true, subagent: 'especialista_nuevo' },
      ]);

      expect(chip.label).toBe(UNKNOWN_SUBAGENT_LABEL);
      expect(chip.label).not.toContain('especialista_nuevo');
      expect(chip.reason).toBe('');
    });
  });

  describe('estado', () => {
    it('nada gira en una conversación vieja', () => {
      const chips = actividadRehidratada([llamada(), llamada({ id: 'tc2', ok: false })]);

      expect(chips.every((c) => !c.running)).toBe(true);
      expect(chips.every((c) => c.durationMs === undefined)).toBe(true);
    });

    it('un fallo se marca', () => {
      const [chip] = actividadRehidratada([llamada({ ok: false })]);

      expect(chip.ok).toBe(false);
    });

    it('«no se supo» no se pinta como fallo', () => {
      const [chip] = actividadRehidratada([llamada({ ok: null })]);

      expect(chip.ok).toBeUndefined();
    });
  });
});

/**
 * El chip rehidratado se tiene que leer IGUAL que el del turno en vivo.
 *
 * Son dos caminos distintos hasta el mismo texto: en vivo se parte del JSON de
 * argumentos que dictó el modelo y aquí de un asunto ya elegido por el agente.
 * Esta tabla es el espejo de su lista blanca (`threads/history.py`) y ata los
 * dos: si alguien cambia una render de `tool-details.ts` pensando sólo en el
 * turno en vivo, esto se cae.
 */
describe('el mismo texto antes y después de recargar', () => {
  const ASUNTO_POR_HERRAMIENTA: [string, string, string][] = [
    ['search_careers', 'query', 'ingeniería industrial'],
    ['search_programs', 'career', 'Ingeniería Industrial'],
    ['web_search', 'query', 'becas Pronabec 2026'],
    ['recommend_programs', 'riasec_code', 'SEC'],
  ];

  for (const [tool, campo, valor] of ASUNTO_POR_HERRAMIENTA) {
    it(`${tool}`, () => {
      const enVivo = toolDetail(tool, JSON.stringify({ [campo]: valor }));

      expect(subjectDetail(tool, valor)).toBe(enVivo);
      expect(enVivo).not.toBe('');
    });
  }
});
