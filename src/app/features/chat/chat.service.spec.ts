import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ChatService } from './chat.service';
import { ChatActivityKind, ChatTurnHandlers } from './chat.model';
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
  const toolsStarted: { id: string; label: string; reason: string; kind: ChatActivityKind }[] = [];
  const toolDetails: { id: string; detail: string }[] = [];
  const toolsEnded: string[] = [];
  const subagentsStarted: { id: string; label: string; reason: string }[] = [];
  const subagentsEnded: { id: string; ok: boolean; durationMs: number }[] = [];
  const snapshots: AgUiSnapshotMessage[][] = [];
  const informesListos: string[] = [];
  const handlers: ChatTurnHandlers = {
    onStep: (label) => steps.push(label),
    onAnswerStart: (messageId) => startedIds.push(messageId),
    onDelta: (messageId, delta) => {
      deltaIds.push(messageId);
      deltas.push(delta);
    },
    onAnswerEnd: (messageId) => endedIds.push(messageId),
    onToolStart: (id, label, reason, kind) => toolsStarted.push({ id, label, reason, kind }),
    onToolDetail: (id, detail) => toolDetails.push({ id, detail }),
    onToolEnd: (id) => toolsEnded.push(id),
    onSubagentStart: (id, label, reason) => subagentsStarted.push({ id, label, reason }),
    onSubagentEnd: (id, ok, durationMs) => subagentsEnded.push({ id, ok, durationMs }),
    onReportReady: (reportId) => informesListos.push(reportId),
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
    toolDetails,
    toolsEnded,
    subagentsStarted,
    subagentsEnded,
    snapshots,
    informesListos,
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
      const { handlers, toolsStarted, toolsEnded, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolsStarted).toEqual([
        {
          id: 'tc-1',
          label: 'Buscando en internet…',
          reason: 'porque eso cambia con el tiempo y no está en los datos que trae',
          // Sale de aquí y no de la pantalla: quien sabe qué herramientas van
          // a internet es el mapa de `tool-labels.ts`.
          kind: 'search',
        },
      ]);
      expect(toolsEnded).toEqual(['tc-1']);
      // El JSON de este caso viene cortado a proposito: sin cerrar, no hay
      // detalle que contar y no se anuncia ninguno.
      expect(toolDetails).toEqual([]);
    });

    it('reassembles the arguments the model dictated in pieces', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'search_programs' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"career": "ingenie' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: 'ría", "location": "Áncash"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        { type: 'TOOL_CALL_RESULT', toolCallId: 'tc-1', content: '{}' },
      ];
      const { handlers, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails).toEqual([{ id: 'tc-1', detail: '«ingeniería» · en Áncash' }]);
    });

    it('announces the detail while the tool is still running', async () => {
      // END llega cuando el modelo termina de dictar los argumentos y RESULT
      // cuando la herramienta acaba. Contar el detalle en END es lo que hace
      // que el chip diga QUE esta buscando mientras busca, y no despues.
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"query": "becas Pronabec"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
      ];
      const { handlers, toolDetails, toolsEnded } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails).toEqual([{ id: 'tc-1', detail: '«becas Pronabec»' }]);
      expect(toolsEnded).toEqual([]);
    });

    it('still reads the arguments when no END arrives', async () => {
      // El camino de respaldo de ag_ui_langgraph (`on_tool_end`) reconstruye
      // la llamada sin emitir END. Sin leerlos tambien en RESULT, por ese
      // camino el detalle no se veria nunca.
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"query": "carreras"}' },
        { type: 'TOOL_CALL_RESULT', toolCallId: 'tc-1', content: '[]' },
      ];
      const { handlers, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails).toEqual([{ id: 'tc-1', detail: '«carreras»' }]);
    });

    it('does not announce the same detail twice', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"query": "carreras"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
        { type: 'TOOL_CALL_RESULT', toolCallId: 'tc-1', content: '[]' },
      ];
      const { handlers, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails.length).toBe(1);
    });

    it('keeps the arguments of two tools running at once apart', async () => {
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-1', toolCallName: 'web_search' },
        { type: 'TOOL_CALL_START', toolCallId: 'tc-2', toolCallName: 'search_careers' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-1', delta: '{"query": "becas"}' },
        { type: 'TOOL_CALL_ARGS', toolCallId: 'tc-2', delta: '{"query": "psicología"}' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-2' },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-1' },
      ];
      const { handlers, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails).toEqual([
        { id: 'tc-2', detail: '«psicología»' },
        { id: 'tc-1', detail: '«becas»' },
      ]);
    });

    it('never sends the instruction the coordinator dictates to a specialist', async () => {
      // El `description` de una `task` es el prompt interno del coordinador.
      // Viaja por el stream; lo que no puede es llegar a la pantalla.
      agent.events = [
        { type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' },
        {
          type: 'TOOL_CALL_ARGS',
          toolCallId: 'tc-9',
          delta: '{"subagent_type": "matching", "description": "Devuelve 5 carreras en JSON"}',
        },
        { type: 'TOOL_CALL_END', toolCallId: 'tc-9' },
      ];
      const { handlers, toolDetails } = recordingHandlers();

      await service.sendTurn('t-1', 'hola', handlers);

      expect(toolDetails).toEqual([]);
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
        {
          id: 'tc-9',
          label: 'Subagente especialista buscando carreras que encajen contigo…',
          reason: 'un especialista cruza ese perfil con el catálogo real del MINEDU',
        },
      ]);
      expect(subagentsEnded).toEqual([{ id: 'tc-9', ok: true, durationMs: 4200 }]);
    });

    /*
     * Lo que escribe un subagente es texto de trabajo, no una respuesta.
     * Habla del estudiante en tercera persona («el estudiante mencionó»,
     * «voy a emitir el informe para este estudiante») porque va dirigido al
     * coordinador. Se pintaba en el chat como si lo dijera el orientador.
     */
    describe('lo que dice un subagente no se pinta', () => {
      function conDelegacion(dentro: AgUiEvent[]): AgUiEvent[] {
        return [
          { type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' },
          {
            type: 'CUSTOM',
            name: 'spark.subagent.start',
            value: { toolCallId: 'tc-9', subagent: 'report' },
          },
          ...dentro,
          {
            type: 'CUSTOM',
            name: 'spark.subagent.end',
            value: { toolCallId: 'tc-9', subagent: 'report', ok: true, durationMs: 900 },
          },
        ];
      }

      it('se descarta entero, sin dejar burbuja', async () => {
        agent.events = conDelegacion([
          { type: 'TEXT_MESSAGE_START', messageId: 'm-sub' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-sub', delta: 'El estudiante mencionó…' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-sub' },
        ]);
        const { handlers, startedIds, deltas, endedIds } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(startedIds).toEqual([]);
        expect(deltas).toEqual([]);
        expect(endedIds).toEqual([]);
      });

      it('el chip de la delegación sí se pinta', async () => {
        // Se descarta el texto, no la señal de que hay alguien trabajando.
        agent.events = conDelegacion([
          { type: 'TEXT_MESSAGE_START', messageId: 'm-sub' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-sub', delta: 'ruido interno' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-sub' },
        ]);
        const { handlers, subagentsStarted, subagentsEnded } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(subagentsStarted).toHaveLength(1);
        expect(subagentsEnded).toHaveLength(1);
      });

      it('lo que dice el coordinador después sí se pinta', async () => {
        agent.events = [
          ...conDelegacion([
            { type: 'TEXT_MESSAGE_START', messageId: 'm-sub' },
            { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-sub', delta: 'ruido interno' },
            { type: 'TEXT_MESSAGE_END', messageId: 'm-sub' },
          ]),
          { type: 'TEXT_MESSAGE_START', messageId: 'm-final' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-final', delta: 'Aquí tienes tu informe.' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-final' },
        ];
        const { handlers, startedIds, deltas } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(startedIds).toEqual(['m-final']);
        expect(deltas).toEqual(['Aquí tienes tu informe.']);
      });

      it('lo que dice el coordinador antes de delegar también', async () => {
        agent.events = [
          { type: 'TEXT_MESSAGE_START', messageId: 'm-antes' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-antes', delta: 'Voy a pedirlo al especialista.' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-antes' },
          ...conDelegacion([]),
        ];
        const { handlers, deltas } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(deltas).toEqual(['Voy a pedirlo al especialista.']);
      });

      it('un cierre que llega tarde no abre una burbuja vacía', async () => {
        // El `end` de la delegación y el del mensaje no llevan orden
        // garantizado. Sin recordar qué mensajes se silenciaron, este
        // `TEXT_MESSAGE_END` pasaría el filtro y crearía una burbuja.
        agent.events = [
          { type: 'TOOL_CALL_START', toolCallId: 'tc-9', toolCallName: 'task' },
          {
            type: 'CUSTOM',
            name: 'spark.subagent.start',
            value: { toolCallId: 'tc-9', subagent: 'report' },
          },
          { type: 'TEXT_MESSAGE_START', messageId: 'm-sub' },
          {
            type: 'CUSTOM',
            name: 'spark.subagent.end',
            value: { toolCallId: 'tc-9', subagent: 'report', ok: true, durationMs: 900 },
          },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-sub', delta: 'cola del subagente' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-sub' },
        ];
        const { handlers, startedIds, deltas, endedIds } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(startedIds).toEqual([]);
        expect(deltas).toEqual([]);
        expect(endedIds).toEqual([]);
      });

      it('dos delegaciones anidadas no destapan el filtro a la primera', async () => {
        agent.events = [
          {
            type: 'CUSTOM',
            name: 'spark.subagent.start',
            value: { toolCallId: 'tc-a', subagent: 'report' },
          },
          {
            type: 'CUSTOM',
            name: 'spark.subagent.start',
            value: { toolCallId: 'tc-b', subagent: 'assessment' },
          },
          {
            type: 'CUSTOM',
            name: 'spark.subagent.end',
            value: { toolCallId: 'tc-b', subagent: 'assessment', ok: true, durationMs: 10 },
          },
          { type: 'TEXT_MESSAGE_START', messageId: 'm-sub' },
          { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm-sub', delta: 'sigo dentro del primero' },
          { type: 'TEXT_MESSAGE_END', messageId: 'm-sub' },
        ];
        const { handlers, deltas } = recordingHandlers();

        await service.sendTurn('t-1', 'hola', handlers);

        expect(deltas).toEqual([]);
      });
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

      expect(subagentsStarted[0].label).toBe('Subagente especialista trabajando…');
      expect(subagentsStarted[0].label).not.toContain('especialista_secreto');
      // Y sin motivo: describir lo que hace un especialista que no se conoce
      // seria inventarselo.
      expect(subagentsStarted[0].reason).toBe('');
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
      expect(subagentsStarted[0].label).toBe('Subagente especialista trabajando…');
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
      const http = TestBed.inject(HttpTestingController);

      await firstValueFrom(service.loadHistory('t-1'));
      await firstValueFrom(service.listThreads());

      http.verify();
    });

    it('lists the simulated conversations instead of nothing', async () => {
      const threads = await firstValueFrom(service.listThreads());

      expect(threads.length).toBeGreaterThan(0);
      expect(threads[0].title).toBeTruthy();
    });

    // Es lo que mantiene «nueva conversación» funcionando en local: al abrir
    // la app el id es un UUID recién creado y el chat tiene que salir limpio.
    it('leaves an unknown conversation empty, like the real endpoint', async () => {
      expect(await firstValueFrom(service.loadHistory('un-id-cualquiera'))).toEqual({
        messages: [],
        running: false,
      });
    });

    it('rehydrates a simulated conversation through the same mapping as the real one', async () => {
      const { messages } = await firstValueFrom(service.loadHistory('mock-hilo-industrial'));

      expect(messages.length).toBeGreaterThan(1);
      // `assistant` -> `ai` lo hace `toChatMessage`, o sea el camino de
      // produccion: el mock sustituye al servidor, no al servicio.
      expect(messages.map((m) => m.role)).toContain('ai');
      expect(messages.every((m) => m.id && m.timestamp)).toBe(true);
    });

    it('surfaces the simulated conversation that is still answering', async () => {
      const { running } = await firstValueFrom(service.loadHistory('mock-hilo-en-curso'));

      expect(running).toBe(true);
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

      expect((await history).messages.map((m) => m.role)).toEqual(['user', 'ai']);
    });

    it('gives a message an id when the agent did not persist one', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http
        .expectOne(`${environment.agentUrl}/threads/t-1/messages`)
        .flush({ thread_id: 't-1', messages: [{ id: null, role: 'user', content: 'hola' }] });

      expect((await history).messages[0].id).toBeTruthy();
    });

    it('survives a response with no messages field', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http.expectOne(`${environment.agentUrl}/threads/t-1/messages`).flush({ thread_id: 't-1' });

      expect(await history).toEqual({ messages: [], running: false });
    });

    it('reports a turn that is still being generated', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http
        .expectOne(`${environment.agentUrl}/threads/t-1/messages`)
        .flush({ thread_id: 't-1', messages: [], running: true });

      expect((await history).running).toBe(true);
    });

    // Un agente anterior a #88 no manda el campo, y ausencia no es «hay un
    // turno corriendo»: darlo por cierto dejaria la pantalla clavada en
    // «respondiendo» esperando a alguien que nunca va a decir que termino.
    it('treats a missing running flag as not running', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http
        .expectOne(`${environment.agentUrl}/threads/t-1/messages`)
        .flush({ thread_id: 't-1', messages: [] });

      expect((await history).running).toBe(false);
    });

    // Lo que hace que al recargar la respuesta no se quede sin procedencia.
    it('brings back the activity that produced each answer', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http.expectOne(`${environment.agentUrl}/threads/t-1/messages`).flush({
        thread_id: 't-1',
        messages: [
          { id: 'm1', role: 'user', content: 'qué carreras' },
          {
            id: 'm2',
            role: 'assistant',
            content: 'estas',
            activity: [
              { id: 'tc1', tool: 'search_careers', ok: true, subject: 'ingeniería' },
              { id: 'tc2', tool: 'task', ok: true, subagent: 'matching' },
            ],
          },
        ],
      });

      const [pregunta, respuesta] = (await history).messages;
      expect(pregunta.activities).toBeUndefined();
      expect(respuesta.activities?.map((a) => a.kind)).toEqual(['tool', 'subagent']);
      expect(respuesta.activities?.[0].detail).toBe('«ingeniería»');
    });

    it('leaves a plain answer without an empty activity list', async () => {
      const history = firstValueFrom(service.loadHistory('t-1'));

      http
        .expectOne(`${environment.agentUrl}/threads/t-1/messages`)
        .flush({ thread_id: 't-1', messages: [{ id: 'm1', role: 'assistant', content: 'hola' }] });

      expect((await history).messages[0].activities).toBeUndefined();
    });

    it('renames a conversation', async () => {
      const renombrada = firstValueFrom(service.renameThread('t-1', 'Becas y costos'));

      const peticion = http.expectOne(`${environment.agentUrl}/threads/t-1`);
      expect(peticion.request.method).toBe('PATCH');
      expect(peticion.request.body).toEqual({ title: 'Becas y costos' });

      peticion.flush({
        thread_id: 't-1',
        title: 'Becas y costos',
        created_at: 'x',
        updated_at: 'x',
      });
      expect((await renombrada).title).toBe('Becas y costos');
    });

    it('deletes a conversation', async () => {
      const borrada = firstValueFrom(service.deleteThread('t-1'));

      const peticion = http.expectOne(`${environment.agentUrl}/threads/t-1`);
      expect(peticion.request.method).toBe('DELETE');
      // Sin cuerpo: el id va en la ruta y el agente saca de la credencial de
      // quien pide, no del JSON, a quien pertenece la conversacion.
      expect(peticion.request.body).toBeNull();

      // El endpoint contesta 204, o sea nada.
      peticion.flush(null, { status: 204, statusText: 'No Content' });
      await expect(borrada).resolves.toBeNull();
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

  describe('el aviso de informe listo llega a la pantalla', () => {
    it('pasa el id del informe emitido', async () => {
      agent.events = [
        {
          type: 'CUSTOM',
          name: 'spark.report.ready',
          value: { reportId: 'rep-42', careers: ['Ingeniería Geofísica'] },
        },
      ];
      const { handlers, informesListos } = recordingHandlers();

      await service.sendTurn('t-1', 'genérame mi reporte', handlers);

      expect(informesListos).toEqual(['rep-42']);
    });

    it('sin id no avisa: un botón que no lleva a ninguna parte es peor que ninguno', async () => {
      agent.events = [{ type: 'CUSTOM', name: 'spark.report.ready', value: { careers: [] } }];
      const { handlers, informesListos } = recordingHandlers();

      await service.sendTurn('t-1', 'genérame mi reporte', handlers);

      expect(informesListos).toEqual([]);
    });

    it('el evento no abre ninguna burbuja de texto', async () => {
      agent.events = [
        { type: 'CUSTOM', name: 'spark.report.ready', value: { reportId: 'rep-42' } },
      ];
      const { handlers, startedCount } = recordingHandlers();

      await service.sendTurn('t-1', 'genérame mi reporte', handlers);

      expect(startedCount()).toBe(0);
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });
});
