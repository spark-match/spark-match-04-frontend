/**
 * Pruebas del fixture, que suena raro hasta que se piensa para qué está.
 *
 * Este mock existe para que los casos difíciles se puedan mirar en local: dos
 * especialistas en un turno, una racha de llamadas a la misma herramienta, un
 * fallo, un turno mudo. Si alguien recorta una conversación al editarlo, el
 * mock sigue funcionando —enseña un chat, nadie se entera— y a la vez deja de
 * servir para lo único que lo justifica. Así que la cobertura del fixture se
 * afirma aquí en vez de confiarla a un comentario.
 */
import { describe, expect, it } from 'vitest';
import { mockHistory, mockThreads } from './chat.mock-threads';
import { relativeDayLabel } from './chat-sessions.store';
import { ThreadActivity } from './chat.model';

function todaLaActividad(): ThreadActivity[] {
  return mockThreads().flatMap((thread) =>
    mockHistory(thread.thread_id).flatMap((message) => message.activity ?? []),
  );
}

describe('mockThreads', () => {
  it('devuelve las conversaciones de más reciente a más antigua', () => {
    const fechas = mockThreads().map((thread) => Date.parse(thread.updated_at));

    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  it('recorta el título a 60 como hace el agente', () => {
    for (const thread of mockThreads()) {
      expect(thread.title.length).toBeLessThanOrEqual(60);
    }
  });

  it('el título sale del primer mensaje del estudiante, no de un texto aparte', () => {
    for (const thread of mockThreads()) {
      const primero = mockHistory(thread.thread_id)[0];

      expect(primero.role).toBe('user');
      expect(primero.content.startsWith(thread.title.replace(/…$/, ''))).toBe(true);
    }
  });

  // Las cuatro ramas de `relativeDayLabel`. Es la razón por la que las fechas
  // se calculan y no son literales: con literales esto se cae solo con el paso
  // del tiempo, que es exactamente el aviso que se quiere.
  it('cubre las cuatro etiquetas de fecha del sidebar', () => {
    const etiquetas = mockThreads().map((thread) => relativeDayLabel(thread.updated_at));

    expect(etiquetas).toContain('Hoy');
    expect(etiquetas).toContain('Ayer');
    expect(etiquetas.some((etiqueta) => etiqueta.startsWith('Hace'))).toBe(true);
    expect(etiquetas.some((etiqueta) => /\d/.test(etiqueta) && !etiqueta.startsWith('Hace'))).toBe(
      true,
    );
  });
});

describe('mockHistory', () => {
  it('una conversación desconocida está vacía, como en el endpoint de verdad', () => {
    expect(mockHistory('no-existe')).toEqual([]);
  });

  it('alterna estudiante y asistente sin dos seguidos del mismo', () => {
    for (const thread of mockThreads()) {
      const roles = mockHistory(thread.thread_id).map((message) => message.role);

      expect(roles.every((role, i) => i === 0 || role !== roles[i - 1])).toBe(true);
    }
  });

  it('todos los ids son distintos, que es de lo que tira `@for track`', () => {
    const ids = mockThreads().flatMap((thread) =>
      mockHistory(thread.thread_id).map((message) => message.id),
    );

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('la actividad sólo cuelga de mensajes del asistente', () => {
    for (const thread of mockThreads()) {
      const conActividad = mockHistory(thread.thread_id).filter((message) => message.activity);

      expect(conActividad.every((message) => message.role === 'assistant')).toBe(true);
    }
  });
});

describe('los casos que el fixture tiene que cubrir', () => {
  it('una racha de la misma herramienta, para ver la agrupación con contador', () => {
    const rachas = mockThreads()
      .flatMap((thread) => mockHistory(thread.thread_id))
      .map((message) => (message.activity ?? []).map((a) => a.tool))
      .filter((tools) => tools.some((tool, i) => i > 0 && tool === tools[i - 1]));

    expect(rachas.length).toBeGreaterThan(0);
  });

  it('dos especialistas en un mismo turno', () => {
    const turnos = mockThreads()
      .flatMap((thread) => mockHistory(thread.thread_id))
      .map((message) => (message.activity ?? []).filter((a) => a.subagent));

    expect(turnos.some((delegaciones) => delegaciones.length >= 2)).toBe(true);
  });

  it('una búsqueda en internet, que es el chip que se trata aparte', () => {
    expect(todaLaActividad().some((a) => a.tool === 'web_search')).toBe(true);
  });

  it('una llamada que falló', () => {
    expect(todaLaActividad().some((a) => a.ok === false)).toBe(true);
  });

  it('una herramienta fuera de la lista blanca, que llega sin asunto', () => {
    expect(todaLaActividad().some((a) => !a.subagent && a.subject === undefined)).toBe(true);
  });

  it('un turno del asistente sin actividad ninguna', () => {
    const respuestas = mockThreads()
      .flatMap((thread) => mockHistory(thread.thread_id))
      .filter((message) => message.role === 'assistant');

    expect(respuestas.some((message) => !message.activity)).toBe(true);
  });

  it('una delegación nunca trae asunto: su argumento es el prompt interno', () => {
    const delegaciones = todaLaActividad().filter((a) => a.subagent);

    expect(delegaciones.length).toBeGreaterThan(0);
    expect(delegaciones.every((a) => a.subject === undefined)).toBe(true);
  });
});
