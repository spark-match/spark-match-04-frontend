/**
 * Pruebas del fixture, que suena raro hasta que se piensa para qué está.
 *
 * Este mock existe para que los casos difíciles se puedan mirar en local: dos
 * especialistas en un turno, una racha de llamadas a la misma herramienta, un
 * fallo, un turno mudo, una conversación que se abre a medio responder. Si
 * alguien recorta una conversación al editarlo, el mock sigue funcionando
 * —enseña un chat, nadie se entera— y a la vez deja de servir para lo único
 * que lo justifica. Así que la cobertura del fixture se afirma aquí en vez de
 * confiarla a un comentario.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockHistory,
  mockRename,
  mockThreads,
  olvidarLosRenombrados,
  reiniciarElHiloEnCurso,
} from './chat.mock-threads';
import { relativeDayLabel } from './chat-sessions.store';
import { ThreadActivity, ThreadMessage } from './chat.model';

/**
 * El historial de una conversación ya terminada.
 *
 * El hilo en curso contesta a medias las primeras veces —esa es su gracia—
 * así que para barrerlo junto a los demás hay que dejarlo llegar al final
 * primero. Sondear hasta que pare es lo mismo que hace la pantalla.
 */
function historialAsentado(threadId: string): ThreadMessage[] {
  let historial = mockHistory(threadId);
  while (historial.running) historial = mockHistory(threadId);
  return historial.messages;
}

function todosLosHistoriales(): ThreadMessage[][] {
  return mockThreads().map((thread) => historialAsentado(thread.thread_id));
}

function todaLaActividad(): ThreadActivity[] {
  return todosLosHistoriales().flatMap((mensajes) =>
    mensajes.flatMap((message) => message.activity ?? []),
  );
}

beforeEach(() => {
  reiniciarElHiloEnCurso();
  olvidarLosRenombrados();
});

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
      const [primero] = historialAsentado(thread.thread_id);

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
    expect(mockHistory('no-existe')).toEqual({ messages: [], running: false });
  });

  it('una conversación terminada no dice que siga corriendo', () => {
    expect(mockHistory('mock-hilo-antiguo').running).toBe(false);
  });

  it('alterna estudiante y asistente sin dos seguidos del mismo', () => {
    for (const mensajes of todosLosHistoriales()) {
      const roles = mensajes.map((message) => message.role);

      expect(roles.every((role, i) => i === 0 || role !== roles[i - 1])).toBe(true);
    }
  });

  it('todos los ids son distintos, que es de lo que tira `@for track`', () => {
    const ids = todosLosHistoriales()
      .flat()
      .map((message) => message.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('la actividad sólo cuelga de mensajes del asistente', () => {
    for (const mensajes of todosLosHistoriales()) {
      const conActividad = mensajes.filter((message) => message.activity);

      expect(conActividad.every((message) => message.role === 'assistant')).toBe(true);
    }
  });
});

/**
 * El turno que sigue vivo al volver a entrar. Es lo único del mock que tiene
 * estado, y es lo que permite ver el sondeo en local sin desplegar.
 */
describe('el hilo en curso', () => {
  const EN_CURSO = 'mock-hilo-en-curso';

  it('empieza con la pregunta y sin respuesta, como el checkpoint a medio turno', () => {
    const historial = mockHistory(EN_CURSO);

    expect(historial.running).toBe(true);
    expect(historial.messages).toHaveLength(1);
    expect(historial.messages[0].role).toBe('user');
  });

  it('acaba contestando: si no, lo que se probaría es una pantalla clavada', () => {
    const asentado = historialAsentado(EN_CURSO);

    expect(asentado.at(-1)?.role).toBe('assistant');
  });

  it('deja de decir que corre en cuanto contesta', () => {
    historialAsentado(EN_CURSO);

    expect(mockHistory(EN_CURSO).running).toBe(false);
  });

  it('se puede volver a empezar, para no arrastrar estado entre casos', () => {
    historialAsentado(EN_CURSO);

    reiniciarElHiloEnCurso();

    expect(mockHistory(EN_CURSO).running).toBe(true);
  });

  it('la respuesta trae actividad, que es lo que aparece al terminar el sondeo', () => {
    const asentado = historialAsentado(EN_CURSO);

    expect(asentado.at(-1)?.activity?.length).toBeGreaterThan(0);
  });
});

describe('mockRename', () => {
  beforeEach(olvidarLosRenombrados);

  it('el listado se queda con el nombre nuevo', () => {
    // Sin esto, renombrar en local se veia un instante y se perdia en cuanto
    // el chat refrescaba la lista al terminar un turno: lo unico que se
    // podia comprobar era el optimismo de la interfaz, no que el nombre dura.
    mockRename('mock-hilo-antiguo', 'Mi primer saludo');

    const thread = mockThreads().find((t) => t.thread_id === 'mock-hilo-antiguo');
    expect(thread?.title).toBe('Mi primer saludo');
  });

  it('devuelve la conversación renombrada, como el endpoint', () => {
    const renombrada = mockRename('mock-hilo-antiguo', 'Mi primer saludo');

    expect(renombrada.thread_id).toBe('mock-hilo-antiguo');
    expect(renombrada.title).toBe('Mi primer saludo');
  });

  it('no mueve la conversación en el sidebar', () => {
    const antes = mockThreads().find((t) => t.thread_id === 'mock-hilo-antiguo');

    const despues = mockRename('mock-hilo-antiguo', 'Otro nombre');

    expect(despues.updated_at).toBe(antes?.updated_at);
  });

  it('no toca las demás', () => {
    mockRename('mock-hilo-antiguo', 'Mi primer saludo');

    const otra = mockThreads().find((t) => t.thread_id === 'mock-hilo-becas');
    expect(otra?.title).toContain('Mis papás');
  });

  it('una conversación que no existe revienta en vez de fingir', () => {
    expect(() => mockRename('no-existe', 'algo')).toThrow();
  });
});

describe('los casos que el fixture tiene que cubrir', () => {
  it('una racha de la misma herramienta, para ver la agrupación con contador', () => {
    const rachas = todosLosHistoriales()
      .flat()
      .map((message) => (message.activity ?? []).map((a) => a.tool))
      .filter((tools) => tools.some((tool, i) => i > 0 && tool === tools[i - 1]));

    expect(rachas.length).toBeGreaterThan(0);
  });

  it('dos especialistas en un mismo turno', () => {
    const turnos = todosLosHistoriales()
      .flat()
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
    const respuestas = todosLosHistoriales()
      .flat()
      .filter((message) => message.role === 'assistant');

    expect(respuestas.some((message) => !message.activity)).toBe(true);
  });

  it('una delegación nunca trae asunto: su argumento es el prompt interno', () => {
    const delegaciones = todaLaActividad().filter((a) => a.subagent);

    expect(delegaciones.length).toBeGreaterThan(0);
    expect(delegaciones.every((a) => a.subject === undefined)).toBe(true);
  });
});
