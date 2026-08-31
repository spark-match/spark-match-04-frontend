/**
 * Un turno simulado del agente, para poder trabajar el chat sin desplegar.
 *
 * Hasta ahora `useMocks` no cubría el stream: `streamRun` hacía `fetch` de
 * verdad pasara lo que pasara, así que en local el chat no respondía nunca y
 * los chips de actividad no se podían ver **en absoluto** — la única forma de
 * mirarlos era desplegar a dev y hablar con el agente real. Trabajar así una
 * pantalla que va de mostrar lo que el agente hace es trabajar a ciegas.
 *
 * Lo que emite no es una respuesta bonita: es la forma REAL de un turno, con
 * las cuatro cosas que la pantalla tiene que saber pintar y que de otro modo
 * solo se ven en producción —
 *
 *   1. Varias llamadas seguidas a la misma herramienta, que es lo que dispara
 *      la agrupación en un chip con contador.
 *   2. Una búsqueda en internet, que va con tratamiento propio porque es el
 *      único dato que no sale del catálogo del MINEDU.
 *   3. Una delegación en un especialista, que llega como evento propio y
 *      asciende el chip genérico de la tool `task`.
 *   4. Texto en trozos, para que el seguimiento del scroll tenga algo que
 *      seguir.
 *
 * Los tiempos son cortos aposta: lo justo para que se vea el estado «en
 * curso» de un chip sin que revisar un cambio de CSS cueste medio minuto.
 */
import { AgUiEvent, RunAgentInput } from './ag-ui.model';
import { SUBAGENT_END_EVENT, SUBAGENT_START_EVENT } from './subagent-labels';

/**
 * Pausa entre eventos. Corta: esto es una herramienta de trabajo.
 *
 * Es un parámetro y no una constante encerrada porque el turno entero dura
 * unos cinco segundos, y eso es demasiado para un test: los suyos lo llaman
 * con 0 y drenan el generador de golpe. De paso, quien esté peleándose con un
 * CSS puede bajarlo sin tocar el código.
 */
export const PAUSA_MS = 220;

const RESPUESTA = [
  'Con lo que me cuentas, ',
  'te van bien las carreras que mezclan análisis y trato con personas. ',
  '\n\n**Ingeniería Industrial** aparece primero: ',
  'está en 41 universidades del país, ',
  'la admisión ronda el 38% y el costo anual mediano son S/ 4.200.\n\n',
  '**Administración** queda cerca por perfil, ',
  'y es bastante más accesible para entrar.\n\n',
  '¿Quieres que mire alguna de las dos en tu región?',
];

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * El texto del estudiante no cambia la respuesta, y no pasa nada: esto no
 * simula al modelo, simula el PROTOCOLO. Lo que tiene que ser fiel es la
 * secuencia de eventos, no lo que dicen.
 */
export async function* mockTurnEvents(
  input: RunAgentInput,
  signal?: AbortSignal,
  pausaMs: number = PAUSA_MS,
): AsyncGenerator<AgUiEvent> {
  const messageId = `mock-${input.runId}`;

  // Se comprueba antes de cada emisión y no solo al principio: un turno
  // simulado dura segundos, y salir de la pantalla a mitad tiene que cortarlo
  // igual que corta al agente de verdad.
  const abortado = (): boolean => signal?.aborted === true;

  async function* emitir(...eventos: AgUiEvent[]): AsyncGenerator<AgUiEvent> {
    for (const evento of eventos) {
      if (abortado()) return;
      yield evento;
      if (pausaMs > 0) await esperar(pausaMs);
    }
  }

  yield* emitir(
    { type: 'RUN_STARTED' },
    { type: 'STEP_STARTED', stepName: 'coordinator' },
  );

  // 1. Tres consultas al catálogo con textos distintos: el coordinador
  //    reformulando. Se tienen que ver como UN chip que dice «3 veces».
  const consultas = ['ingeniería', 'administración de empresas', 'gestión'];
  for (const [i, consulta] of consultas.entries()) {
    const id = `mock-tool-catalogo-${i}`;
    yield* emitir(
      { type: 'TOOL_CALL_START', toolCallId: id, toolCallName: 'search_careers' },
      { type: 'TOOL_CALL_ARGS', toolCallId: id, delta: `{"query": "${consulta}"}` },
      { type: 'TOOL_CALL_END', toolCallId: id },
      { type: 'TOOL_CALL_RESULT', toolCallId: id, content: '[...]' },
    );
  }

  // 2. Una búsqueda en internet: el único chip que no sale del catálogo.
  const idWeb = 'mock-tool-web';
  yield* emitir(
    { type: 'TOOL_CALL_START', toolCallId: idWeb, toolCallName: 'web_search' },
    { type: 'TOOL_CALL_ARGS', toolCallId: idWeb, delta: '{"query": "becas Pronabec 2026"}' },
    { type: 'TOOL_CALL_END', toolCallId: idWeb },
    { type: 'TOOL_CALL_RESULT', toolCallId: idWeb, content: '[...]' },
  );

  // 3. Una delegación. El `toolCallId` es el mismo que el de la tool `task`
  //    que la envuelve, que es como asciende el chip en vez de duplicarlo.
  const idTask = 'mock-task-matching';
  yield* emitir(
    { type: 'TOOL_CALL_START', toolCallId: idTask, toolCallName: 'task' },
    {
      type: 'CUSTOM',
      name: SUBAGENT_START_EVENT,
      value: { toolCallId: idTask, subagent: 'matching' },
    },
    {
      type: 'CUSTOM',
      name: SUBAGENT_END_EVENT,
      value: { toolCallId: idTask, ok: true, durationMs: 2400 },
    },
    { type: 'TOOL_CALL_RESULT', toolCallId: idTask, content: '[...]' },
  );

  // 4. La respuesta, en trozos.
  yield* emitir({ type: 'TEXT_MESSAGE_START', messageId });
  for (const trozo of RESPUESTA) {
    yield* emitir({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: trozo });
  }
  yield* emitir({ type: 'TEXT_MESSAGE_END', messageId }, { type: 'RUN_FINISHED' });
}
