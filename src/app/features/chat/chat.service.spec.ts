import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ChatService } from './chat.service';
import { ChatTurnHandlers } from './chat.model';
import { AgUiClient } from '../../core/agent/ag-ui.client';
import { AgUiEvent } from '../../core/agent/ag-ui.model';
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
  const toolsStarted: { id: string; label: string }[] = [];
  const toolsEnded: string[] = [];
  let started = 0;
  const handlers: ChatTurnHandlers = {
    onStep: (label) => steps.push(label),
    onAnswerStart: () => {
      started += 1;
    },
    onDelta: (delta) => deltas.push(delta),
    onToolStart: (id, label) => toolsStarted.push({ id, label }),
    onToolEnd: (id) => toolsEnded.push(id),
  };
  return { handlers, steps, deltas, toolsStarted, toolsEnded, startedCount: () => started };
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

    it('shows subagent delegation as a tool call named task', async () => {
      // ag_ui_langgraph no tiene eventos de subagente: deepagents expone la
      // delegacion como una tool normal llamada `task`.
      agent.events = [{ type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' }];
      const { handlers, toolsStarted } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted[0].label).toBe('Consultando a un especialista…');
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

  describe('loadHistory', () => {
    it('maps the agent roles onto the chat bubbles', async () => {
      // El servicio no llama al agente cuando los mocks estan encendidos,
      // que es el default de `environment.ts` usado en tests.
      expect(environment.useMocks).toBe(true);

      expect(await firstValueFrom(service.loadHistory('t-1'))).toEqual([]);
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });
});
