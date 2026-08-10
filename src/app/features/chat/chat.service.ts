import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AgUiClient } from '../../core/agent/ag-ui.client';
import { stepLabel } from '../../core/agent/step-labels';
import { toolKind, toolLabel } from '../../core/agent/tool-labels';
import { toolDetail, toolReason } from '../../core/agent/tool-details';
import {
  SUBAGENT_END_EVENT,
  SUBAGENT_START_EVENT,
  subagentLabel,
  subagentReason,
} from '../../core/agent/subagent-labels';
import { AgUiEvent, AgUiSnapshotMessage, RunAgentInput } from '../../core/agent/ag-ui.model';
import {
  ChatMessage,
  ChatThread,
  ChatTurnHandlers,
  ThreadMessage,
  ThreadMessagesResponse,
  ThreadsResponse,
} from './chat.model';
import { mockHistory, mockThreads } from './chat.mock-threads';
import { actividadRehidratada } from './activity-rehydration';

const THREAD_STORAGE_KEY = 'spark-match:chat-thread';

/**
 * El chat contra el deep-agent.
 *
 * Antes esto apuntaba a `${apiUrl}/chat/sessions`, una ruta inventada para el
 * mockup que el backend nunca tuvo ni va a tener: el ADR-012 decide que el
 * frontend habla DIRECTO con el agente. En el dev desplegado (`useMocks:
 * false`) esa llamada devolvia 404, asi que el chat no mostraba mocks — no
 * respondia nada.
 */
@Service()
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly agent = inject(AgUiClient);

  /**
   * Id de conversacion del lado del cliente.
   *
   * El agente no lo usa crudo: deriva `sha256(user_id:threadId)` para keyear
   * el checkpointer, asi que dos usuarios con el mismo id de cliente nunca
   * colisionan. Guardarlo en localStorage hace que recargar la pagina siga la
   * misma conversacion en vez de empezar de cero.
   */
  currentThreadId(): string {
    const stored = localStorage.getItem(THREAD_STORAGE_KEY);
    if (stored) return stored;

    const fresh = crypto.randomUUID();
    localStorage.setItem(THREAD_STORAGE_KEY, fresh);
    return fresh;
  }

  startNewThread(): string {
    const fresh = crypto.randomUUID();
    localStorage.setItem(THREAD_STORAGE_KEY, fresh);
    return fresh;
  }

  /**
   * Fija cuál es la conversación actual.
   *
   * La llama el chat cuando el id llega por la URL, para que volver a
   * `/assessment` sin id caiga en la que se estaba mirando y no en otra.
   */
  rememberThread(threadId: string): void {
    localStorage.setItem(THREAD_STORAGE_KEY, threadId);
  }

  /** Conversaciones del usuario, más recientes primero (las ordena el agente). */
  listThreads(): Observable<ChatThread[]> {
    if (environment.useMocks) return of(mockThreads());

    return this.http
      .get<ThreadsResponse>(`${environment.agentUrl}/threads`)
      .pipe(map((response) => response.threads ?? []));
  }

  /** Historial de la conversacion, para repoblar el chat al recargar. */
  loadHistory(threadId: string): Observable<ChatMessage[]> {
    // El mock devuelve la forma de la RESPUESTA y se traduce igual que la de
    // verdad, con el mismo `toChatMessage`. Devolver aquí `ChatMessage[]` ya
    // hechos dejaría sin ejercitar en local justo el trozo que traduce.
    if (environment.useMocks) return of(mockHistory(threadId).map(toChatMessage));

    return this.http
      .get<ThreadMessagesResponse>(`${environment.agentUrl}/threads/${threadId}/messages`)
      .pipe(map((response) => (response.messages ?? []).map(toChatMessage)));
  }

  /**
   * Envia un turno y va notificando lo que pasa mientras el agente trabaja.
   *
   * Devuelve callbacks en vez de un Observable porque un turno no es un
   * valor: son tres cosas distintas ocurriendo a la vez — texto que crece,
   * pasos que cambian, y un final. Empaquetarlo en un `Observable<ChatMessage>`
   * obligaria a re-emitir el mensaje entero en cada token.
   */
  async sendTurn(
    threadId: string,
    text: string,
    handlers: ChatTurnHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    const input: RunAgentInput = {
      threadId,
      runId: crypto.randomUUID(),
      state: {},
      messages: [{ id: crypto.randomUUID(), role: 'user', content: text }],
      tools: [],
      context: [],
      forwardedProps: {},
    };

    // El id del mensaje que se esta escribiendo ahora. El protocolo lo trae
    // en cada evento, pero no todos los caminos internos de ag_ui_langgraph
    // lo rellenan, asi que se recuerda el ultimo como respaldo.
    let openMessageId = '';

    // Lo que hace falta para contar CON QUE se llamo a cada herramienta.
    // `TOOL_CALL_ARGS` trae el id y un trozo de JSON, pero no el nombre de la
    // herramienta — sin recordarlo del START no hay forma de saber que campos
    // de esos argumentos se pueden ensenar. Y los trozos por separado no
    // parsean, asi que se acumulan hasta que el modelo termina de dictarlos.
    const toolNames = new Map<string, string>();
    const pendingArgs = new Map<string, string>();

    const flushDetail = (toolCallId: string): void => {
      const rawArgs = pendingArgs.get(toolCallId);
      if (rawArgs === undefined) return;
      // Se consume una sola vez: lo llaman END y RESULT, y el detalle no
      // cambia entre uno y otro.
      pendingArgs.delete(toolCallId);

      const detail = toolDetail(toolNames.get(toolCallId), rawArgs);
      if (detail) handlers.onToolDetail(toolCallId, detail);
    };

    for await (const event of this.agent.streamRun(input, signal)) {
      switch (event.type) {
        case 'STEP_STARTED': {
          // Un paso sin etiqueta conocida no cambia nada en pantalla: es
          // fontaneria del grafo, no algo que el estudiante deba leer.
          const label = stepLabel(event.stepName);
          if (label) handlers.onStep(label);
          break;
        }
        case 'TOOL_CALL_START': {
          // toolCallName es el nombre de la funcion en el agente; toolLabel
          // lo traduce y nunca lo deja pasar crudo al navegador.
          const toolCallId = event.toolCallId ?? '';
          toolNames.set(toolCallId, event.toolCallName ?? '');
          handlers.onToolStart(
            toolCallId,
            toolLabel(event.toolCallName),
            toolReason(event.toolCallName),
            toolKind(event.toolCallName),
          );
          break;
        }
        case 'TOOL_CALL_ARGS': {
          // Trozo a trozo, sin intentar parsear: cada delta es un pedazo del
          // JSON y por si solo no es JSON valido.
          const toolCallId = event.toolCallId ?? '';
          pendingArgs.set(toolCallId, (pendingArgs.get(toolCallId) ?? '') + (event.delta ?? ''));
          break;
        }
        case 'TOOL_CALL_END':
          // END significa que el modelo termino de dictar los argumentos, asi
          // que aqui ya hay un JSON entero que leer. El chip sigue corriendo:
          // quien lo cierra es RESULT.
          flushDetail(event.toolCallId ?? '');
          break;
        case 'TOOL_CALL_RESULT':
          // Tambien aqui, porque el camino de respaldo de ag_ui_langgraph
          // (`on_tool_end`) reconstruye la llamada sin emitir END: sin esto,
          // por ese camino el detalle no se veria nunca.
          flushDetail(event.toolCallId ?? '');
          // Se cierra con el RESULT y no con TOOL_CALL_END: END puede llegar
          // en cuanto el modelo termina de dictar los argumentos, antes de
          // que la herramienta se haya ejecutado.
          handlers.onToolEnd(event.toolCallId ?? '');
          break;
        case 'TEXT_MESSAGE_START':
          openMessageId = String(event.messageId ?? crypto.randomUUID());
          handlers.onAnswerStart(openMessageId);
          break;
        case 'TEXT_MESSAGE_CONTENT':
          if (event.delta) handlers.onDelta(String(event.messageId ?? openMessageId), event.delta);
          break;
        case 'TEXT_MESSAGE_END':
          handlers.onAnswerEnd(String(event.messageId ?? openMessageId));
          openMessageId = '';
          break;
        case 'MESSAGES_SNAPSHOT':
          handlers.onSnapshot(readSnapshotMessages(event.messages));
          break;
        case 'CUSTOM':
          handleCustomEvent(event, handlers);
          break;
        case 'RUN_ERROR':
          throw new Error(event.message ?? 'run error');
        default:
          break;
      }
    }
  }
}

/**
 * Eventos propios del agente, documentados en su `docs/ag-ui-events.md`.
 *
 * Llevan el mismo `toolCallId` que la tool call `task` que los envuelve, y
 * eso es deliberado: el chip generico ya existe cuando llega el `start`, asi
 * que la interfaz lo asciende a «Evaluando tu perfil vocacional…» en vez de
 * pintar un segundo chip para lo mismo.
 */
function handleCustomEvent(event: AgUiEvent, handlers: ChatTurnHandlers): void {
  const value = (event.value ?? {}) as Record<string, unknown>;
  const toolCallId = asText(value['toolCallId']);

  if (event.name === SUBAGENT_START_EVENT) {
    const subagent = asText(value['subagent']) || undefined;
    handlers.onSubagentStart(toolCallId, subagentLabel(subagent), subagentReason(subagent));
    return;
  }
  if (event.name === SUBAGENT_END_EVENT) {
    // `ok !== false` y no `=== true`: si un agente viejo no manda el campo,
    // lo razonable es asumir que fue bien, no pintar un fallo inventado.
    handlers.onSubagentEnd(toolCallId, value['ok'] !== false, asNumber(value['durationMs']));
  }
}

/**
 * Lee un campo del cuerpo de un evento como texto.
 *
 * `String(x)` no vale: sobre un objeto devuelve `'[object Object]'`, que como
 * clave de chip casaria con la de cualquier otro objeto — dos delegaciones
 * distintas compartirian indicador. El cuerpo de un evento CUSTOM es
 * `unknown`, asi que lo que no sea texto ni numero no es un identificador y
 * se trata como ausente.
 */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  return typeof value === 'number' ? String(value) : '';
}

/** Misma idea para los numeros: `Number({})` es `NaN`, y `NaN ms` en pantalla. */
function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Se queda solo con lo que la UI puede pintar, y descarta el resto sin ruido. */
function readSnapshotMessages(messages: unknown): AgUiSnapshotMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message): message is Record<string, unknown> =>
        typeof message === 'object' && message !== null,
    )
    .filter(
      (message) => typeof message['content'] === 'string' && typeof message['role'] === 'string',
    )
    .map((message) => ({
      id: asText(message['id']),
      role: String(message['role']),
      content: String(message['content']),
    }));
}

function toChatMessage(message: ThreadMessage): ChatMessage {
  const activities = actividadRehidratada(message.activity);

  return {
    id: message.id ?? crypto.randomUUID(),
    role: message.role === 'user' ? 'user' : 'ai',
    text: message.content,
    // El agente no persiste timestamps por mensaje. Se usa el momento de la
    // carga para no inventar una hora que parezca real y no lo sea.
    timestamp: new Date().toISOString(),
    // Sin la clave cuando no hay nada, y no con una lista vacia: la plantilla
    // pregunta por `activities?.length`, y un `[]` seria un campo presente que
    // no significa nada.
    ...(activities.length ? { activities } : {}),
  };
}
