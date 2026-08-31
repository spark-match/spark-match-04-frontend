import { describe, expect, it } from 'vitest';

import { AgUiEvent, RunAgentInput } from './ag-ui.model';
import { SUBAGENT_END_EVENT, SUBAGENT_START_EVENT } from './subagent-labels';
import { mockTurnEvents } from './ag-ui.mock-stream';

const INPUT: RunAgentInput = {
  threadId: 't-1',
  runId: 'r-1',
  state: {},
  messages: [{ id: 'm-0', role: 'user', content: 'hola' }],
  tools: [],
  context: [],
  forwardedProps: {},
};

/** Sin pausas: el turno completo dura unos 5s y aqui no hay nada que mirar. */
async function recoger(signal?: AbortSignal): Promise<AgUiEvent[]> {
  const eventos: AgUiEvent[] = [];
  for await (const evento of mockTurnEvents(INPUT, signal, 0)) eventos.push(evento);
  return eventos;
}

/**
 * El mock es una herramienta de trabajo, no producto — pero si deja de emitir
 * alguna de las cuatro formas, el chat vuelve a no poder desarrollarse en
 * local y nadie se entera hasta que toca la pantalla de actividad. De ahi que
 * lo que se comprueba aqui sea la COBERTURA de casos, no el texto.
 */
describe('mockTurnEvents', () => {
  it('agrupa varias llamadas seguidas a la misma herramienta', async () => {
    // Es lo que dispara el chip con contador. Con una sola llamada, la
    // agrupacion no se puede ver en local.
    const catalogo = (await recoger()).filter(
      (e) => e.type === 'TOOL_CALL_START' && e.toolCallName === 'search_careers',
    );
    expect(catalogo.length).toBeGreaterThan(1);
  });

  it('incluye una busqueda en internet', async () => {
    // El unico chip que no sale del catalogo del MINEDU, y el unico con
    // tratamiento visual propio.
    const web = (await recoger()).filter(
      (e) => e.type === 'TOOL_CALL_START' && e.toolCallName === 'web_search',
    );
    expect(web).toHaveLength(1);
  });

  it('incluye una delegacion en un especialista, con su cierre', async () => {
    const eventos = await recoger();
    const inicio = eventos.find((e) => e.name === SUBAGENT_START_EVENT);
    const fin = eventos.find((e) => e.name === SUBAGENT_END_EVENT);

    expect(inicio).toBeDefined();
    expect(fin).toBeDefined();
    // Mismo id que la tool `task` que lo envuelve: asi el chip generico se
    // asciende en vez de pintarse un segundo chip para lo mismo.
    const task = eventos.find((e) => e.toolCallName === 'task');
    expect((inicio?.value as Record<string, unknown>)['toolCallId']).toBe(task?.toolCallId);
  });

  it('manda la respuesta en trozos y no de golpe', async () => {
    // Un solo delta no dejaria ver el seguimiento del scroll ni el cursor de
    // escritura, que es la mitad de lo que hay que mirar en esta pantalla.
    const deltas = (await recoger()).filter((e) => e.type === 'TEXT_MESSAGE_CONTENT');
    expect(deltas.length).toBeGreaterThan(3);
  });

  it('abre y cierra el turno como el agente de verdad', async () => {
    const tipos = (await recoger()).map((e) => e.type);
    expect(tipos[0]).toBe('RUN_STARTED');
    expect(tipos.at(-1)).toBe('RUN_FINISHED');
  });

  it('se corta al abortar', async () => {
    // Salir de la pantalla a mitad de turno tiene que cortar el simulado
    // igual que corta al agente: si no, el mock seguiria escribiendo contra
    // un componente que ya se destruyo.
    const control = new AbortController();
    control.abort();

    expect(await recoger(control.signal)).toEqual([]);
  });
});
