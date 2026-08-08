import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ChatService } from './chat.service';
import { ChatTurnHandlers } from './chat.model';
import { AgUiClient } from '../../core/agent/ag-ui.client';
import { AgUiEvent, AgUiSnapshotMessage } from '../../core/agent/ag-ui.model';
import { environment } from '../../../environments/environment';

/** Reemplaza el transporte SSE por una lista fija de eventos. */
class FakeAgUiClient {
  events: AgUiEvent[] = [];
  lastInput: unknown = null;

  async *streamRun(input: unknown) {
    this.lastInput = input;
    for (const event of this.events) yield event;
  }
}

function recordingHandlers() {
  const steps: string[] = [];
  const deltas: string[] = [];
  const deltaIds: string[] = [];
  const startedIds: string[] = [];
  const endedIds: string[] = [];
  const toolsStarted: { id: string; label: string }[] = [];
  const toolsEnded: string[] = [];
  const subagentsStarted: { id: string; label: string }[] = [];
  const subagentsEnded: { id: string; ok: boolean; durationMs: number }[] = [];
  const snapshots: AgUiSnapshotMessage[][] = [];
  const handlers: ChatTurnHandlers = {
    onStep: (label) => steps.push(label),
    onAnswerStart: (messageId) => startedIds.push(messageId),
    onDelta: (messageId, delta) => {
      deltaIds.push(messageId);
      deltas.push(delta);
    },
    onAnswerEnd: (messageId) => endedIds.push(messageId),
    onToolStart: (id, label) => toolsStarted.push({ id, label }),
    onToolEnd: (id) => toolsEnded.push(id),
    onSubagentStart: (id, label) => subagentsStarted.push({ id, label }),
    onSubagentEnd: (id, ok, durationMs) => subagentsEnded.push({ id, ok, durationMs }),
    onSnapshot: (messages) => snapshots.push(messages),
  };
  return {
    handlers,
    steps,
    deltas,
    deltaIds,
    startedIds,
    endedIds,
    toolsStarted,
    toolsEnded,
    subagentsStarted,
    subagentsEnded,
    snapshots,
    startedCount: () => startedIds.length,
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let agent: FakeAgUiClient;

  beforeEach(() => {
    localStorage.clear();
    agent = new FakeAgUiClient();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AgUiClient, useValue: agent },
      ],
    });
    service = TestBed.inject(ChatService);
  });

  describe('thread id', () => {
    it('reuses the same id across calls so a reload continues the conversation', () => {
      const first = service.currentThreadId();

      expect(service.currentThreadId()).toBe(first);
    });

    it('starts a genuinely new conversation on demand', () => {
      const first = service.currentThreadId();

      const second = service.startNewThread();

      expect(second).not.toBe(first);
      expect(service.currentThreadId()).toBe(second);
    });
  });

  describe('sendTurn', () => {
    it('reports each recognisable step before the answer starts', async () => {
      agent.events = [
        { type: 'STEP_STARTED', stepName: 'MemoryMiddleware.before_agent' },
        { type: 'STEP_STARTED', stepName: 'model' },
        { type: 'TEXT_MESSAGE_START' },
      ];
      const { handlers, steps } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(steps).toEqual(['Recordando lo que ya sé de ti…', 'Pensando…']);
    });

    it('does not report plumbing steps', async () => {
      agent.events = [{ type: 'STEP_STARTED', stepName: 'TodoListMiddleware.after_model' }];
      const { handlers, steps } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(steps).toEqual([]);
    });

    it('streams the answer delta by delta', async () => {
      agent.events = [
        { type: 'TEXT_MESSAGE_START' },
        { type: 'TEXT_MESSAGE_CONTENT', delta: 'Hola' },
        { type: 'TEXT_MESSAGE_CONTENT', delta: ', ¿qué' },
        { type: 'TEXT_MESSAGE_CONTENT', delta: ' te gusta?' },
        { type: 'TEXT_MESSAGE_END' },
      ];
      const { handlers, deltas, startedCount } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(startedCount()).toBe(1);
      expect(deltas.join('')).toBe('Hola, ¿qué te gusta?');
    });

    it('sends the thread id and the message the student typed', async () => {
      const { handlers } = recordingHandlers();

      await service.sendTurn('t-42', 'me gustan las matemáticas', handlers);

      const input = agent.lastInput as { threadId: string; messages: { content: string }[] };
      expect(input.threadId).toBe('t-42');
      expect(input.messages[0].content).toBe('me gustan las matemáticas');
    });

    it('announces a web search in words, never the function name', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"query": "carreras"' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        { type: 'TOOL_CALL_RESULT', toolCallId: 'tc-1', content: '[...]' },
      ];
      const { handlers, toolsStarted, toolsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted).toEqual([{ id: 'tc-1', label: 'Buscando en internet…' }]);
      expect(toolsEnded).toEqual(['tc-1']);
    });

    it('closes a tool on its RESULT, not on TOOL_CALL_END', async () => {
      // END llega en cuanto el modelo termina de dictar los argumentos, antes
      // de que la herramienta se haya ejecutado: cerrarla ahi mostraria como
      // terminada una busqueda que aun no empezo.
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
      ];
      const { handlers, toolsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsEnded).toEqual([]);
    });

    it('falls back to a generic label for the task tool', async () => {
      // AG-UI no tiene eventos de subagente: deepagents expone la delegacion
      // como una tool normal llamada `task`. Ese chip generico es lo unico
      // que hay hasta que llegan los eventos propios del agente.
      agent.events = [{ type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' }];
      const { handlers, toolsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted[0].label).toBe('Consultando a un especialista…');
    });

    it('names the tool that writes preferences by its real name', async () => {
      // El nombre en el stream es `manage_memory`. `manage_prefs` solo es la
      // variable de Python del agente, y con esa clave el mapa fallaba y
      // anotar una preferencia se anunciaba como "Usando una herramienta…".
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'manage_memory' },
      ];
      const { handlers, toolsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted[0].label).toBe('Anotando tus preferencias…');
    });

    it('says which specialist the coordinator delegated to', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' },
        {
          type: 'CUSTOM',
          name: 'spark.subagent.start',
          value: { toolCallId: 'tc-9', subagent: 'matching' },
        },
        {
          type: 'CUSTOM',
          name: 'spark.subagent.end',
          value: { toolCallId: 'tc-9', subagent: 'matching', ok: true, durationMs: 4200 },
        },
      ];
      const { handlers, subagentsStarted, subagentsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(subagentsStarted).toEqual([
        { id: 'tc-9', label: 'Buscando carreras que encajen contigo…' },
      ]);
      expect(subagentsEnded).toEqual([{ id: 'tc-9', ok: true, durationMs: 4200 }]);
    });

    it('never leaks the internal key of a specialist it does not know', async () => {
      agent.events = [
        {
          type: 'CUSTOM',
          name: 'spark.subagent.start',
          value: { toolCallId: 'tc-1', subagent: 'especialista_secreto' },
        },
      ];
      const { handlers, subagentsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(subagentsStarted[0].label).toBe('Consultando a un especialista…');
      expect(subagentsStarted[0].label).not.toContain('especialista_secreto');
    });

    it('assumes a delegation went fine when the agent does not say otherwise', async () => {
      // Un agente anterior al contrato no manda `ok`. Pintar un fallo
      // inventado seria peor que asumir que fue bien.
      agent.events = [
        { type: 'CUSTOM', name: 'spark.subagent.end', value: { toolCallId: 'tc-1' } },
      ];
      const { handlers, subagentsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(subagentsEnded[0].ok).toBe(true);
    });

    it('does not turn a malformed payload into a colliding chip id', async () => {
      // El cuerpo de un CUSTOM es `unknown`. `String({})` da '[object Object]',
      // que como clave casaria con la de cualquier otro objeto: dos
      // delegaciones distintas compartirian indicador.
      agent.events = [
        {
          type: 'CUSTOM',
          name: 'spark.subagent.start',
          value: { toolCallId: { raro: true }, subagent: { tambien: true } },
        },
        {
          type: 'CUSTOM',
          name: 'spark.subagent.end',
          value: { toolCallId: 'tc-1', durationMs: 'ocho segundos' },
        },
      ];
      const { handlers, subagentsStarted, subagentsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(subagentsStarted[0].id).toBe('');
      expect(subagentsStarted[0].label).toBe('Consultando a un especialista…');
      // Una duracion ilegible se ensena como nada, no como "NaN ms".
      expect(subagentsEnded[0].durationMs).toBe(0);
    });

    it('ignores a custom event it does not know', async () => {
      agent.events = [
        { type: 'CUSTOM', name: 'spark.algo.nuevo', value: { x: 1 } },
        { type: 'TEXT_MESSAGE_START' },
      ];
      const { handlers, startedCount } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(startedCount()).toBe(1);
    });

    it('keeps each answer of the turn under its own message id', async () => {
      // Un turno puede producir varias burbujas: el coordinador escribe,
      // delega, y vuelve a escribir.
      agent.events = [
        { type: 'TEXT_MESSAGE_START', messageId: 'm-1' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-1', delta: 'uno' },
        { type: 'TEXT_MESSAGE_END', messageId: 'm-1' },
        { type: 'TEXT_MESSAGE_START', messageId: 'm-2' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-2', delta: 'dos' },
        { type: 'TEXT_MESSAGE_END', messageId: 'm-2' },
      ];
      const { handlers, startedIds, deltaIds, endedIds } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(startedIds).toEqual(['m-1', 'm-2']);
      expect(deltaIds).toEqual(['m-1', 'm-2']);
      expect(endedIds).toEqual(['m-1', 'm-2']);
    });

    it('invents an id when the agent does not send one', async () => {
      agent.events = [
        { type: 'TEXT_MESSAGE_START' },
        { type: 'TEXT_MESSAGE_CONTENT', delta: 'hola' },
      ];
      const { handlers, startedIds, deltaIds } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(startedIds[0]).toBeTruthy();
      expect(deltaIds).toEqual([startedIds[0]]);
    });

    it('forwards the thread snapshot', async () => {
      agent.events = [
        {
          type: 'MESSAGES_SNAPSHOT',
          messages: [
            { id: 'm1', role: 'user', content: 'hola' },
            { id: 'm2', role: 'assistant', content: 'no puedo ayudarte con eso' },
          ],
        },
      ];
      const { handlers, snapshots } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(snapshots[0].map((m) => m.role)).toEqual(['user', 'assistant']);
      expect(snapshots[0][1].content).toBe('no puedo ayudarte con eso');
    });

    it('drops snapshot entries the UI cannot paint', async () => {
      agent.events = [
        {
          type: 'MESSAGES_SNAPSHOT',
          messages: [
            { id: 'm1', role: 'tool', content: '[{"id": 1}]' },
            { id: 'm2', role: 'assistant', content: null },
            'basura',
            { id: 'm3', role: 'assistant', content: 'ok' },
          ],
        },
      ];
      const { handlers, snapshots } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(snapshots[0].map((m) => m.id)).toEqual(['m1', 'm3']);
    });

    it('survives a snapshot that is not a list', async () => {
      agent.events = [{ type: 'MESSAGES_SNAPSHOT', messages: null }];
      const { handlers, snapshots } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(snapshots[0]).toEqual([]);
    });

    it('tolerates a tool event with no id', async () => {
      agent.events = [{ type: 'TOOL_CALL_START', toolCallName: 'web_search' }];
      const { handlers, toolsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted[0].id).toBe('');
    });

    it('never leaks the name of a tool it does not know', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-2', toolCallName: 'herramienta_secreta_v2' },
      ];
      const { handlers, toolsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted[0].label).toBe('Usando una herramienta…');
      expect(toolsStarted[0].label).not.toContain('herramienta_secreta_v2');
    });

    it('surfaces a RUN_ERROR instead of ending the turn silently', async () => {
      agent.events = [{ type: 'RUN_ERROR', message: 'boom' }];
      const { handlers } = recordingHandlers();

      await expect(service.sendTurn('t-1', 'hola', handlers)).rejects.toThrow('boom');
    });

    it('ignores event types it does not know', async () => {
      agent.events = [{ type: 'ALGO_NUEVO' }, { type: 'TEXT_MESSAGE_START' }];
      const { handlers, startedCount } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(startedCount()).toBe(1);
    });
  });

  describe('with mocks enabled (the default of environment.ts in tests)', () => {
    it('does not call the agent at all', async () => {
      expect(environment.useMocks).toBe(true);

      expect(await firstValueFrom(service.loadHistory('t-1'))).toEqual([]);
      expect(await firstValueFrom(service.listThreads())).toEqual([]);
    });
  });

  describe('against the real agent', () => {
    // Los caminos HTTP son los que corren en produccion, y con useMocks=true
    // ningun test los tocaba. Se apaga la bandera aqui y se restaura despues.
    let http: HttpTestingController;

    beforeEach(() => {
      environment.useMocks = false;
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      environment.useMocks = true;
    });

    it('maps the agent roles onto the chat bubbles', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http.expectOne(`${environment.agentUrl}/threads/t-1/messages`).flush({
        thread_id: 't-1',
        messages: [
          { id: 'm1', role: 'user', content: 'hola' },
          { id: 'm2', role: 'assistant', content: 'qué tal' },
        ],
      });

      expect((await history).map((m) => m.role)).toEqual(['user', 'ai']);
    });

    it('gives a message an id when the agent did not persist one', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http
        .expectOne(`${environment.agentUrl}/threads/t-1/messages`)
        .flush({ thread_id: 't-1', messages: [{ id: null, role: 'user', content: 'hola' }] });

      expect((await history)[0].id).toBeTruthy();
    });

    it('survives a response with no messages field', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http.expectOne(`${environment.agentUrl}/threads/t-1/messages`).flush({ thread_id: 't-1' });

      expect(await history).toEqual([]);
    });

    it('lists the threads', async () => {
      const threads = firstValueFrom(service.listThreads());

      http.expectOne(`${environment.agentUrl}/threads`).flush({
        threads: [{ thread_id: 'a', title: 'una', created_at: 'x', updated_at: 'x' }],
      });

      expect((await threads).map((t) => t.thread_id)).toEqual(['a']);
    });

    it('survives a thread listing with no threads field', async () => {
      const threads = firstValueFrom(service.listThreads());

      http.expectOne(`${environment.agentUrl}/threads`).flush({});

      expect(await threads).toEqual([]);
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });
});
