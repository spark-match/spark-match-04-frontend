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
  REPORT_READY_EVENT,
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
  ThreadHistory,
  ThreadMessage,
  ThreadMessagesResponse,
  ThreadsResponse,
} from './chat.model';
import { mockDelete, mockHistory, mockRename, mockThreads } from './chat.mock-threads';
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

  /**
   * Cambia el nombre de una conversación.
   *
   * El título que pone el agente es el primer mensaje recortado, que sirve
   * para reconocer una conversación recién tenida y no para encontrarla
   * dentro de tres semanas entre otras diez que empiezan igual.
   */
  renameThread(threadId: string, title: string): Observable<ChatThread> {
    if (environment.useMocks) return of(mockRename(threadId, title));

    return this.http.patch<ChatThread>(`${environment.agentUrl}/threads/${threadId}`, { title });
  }

  /**
   * Borra una conversación: sus mensajes, su entrada en el índice y el
   * registro de quién es su dueño.
   *
   * No hay papelera ni deshacer, ni aquí ni en el agente: lo que se borra se
   * va. Por eso quien llame tiene que preguntar antes — este método no
   * pregunta nada.
   *
   * Lo que NO se lleva por delante es el perfil del estudiante (RIASEC, edad,
   * intereses). Vive en otro sitio, particionado por `user_id` y no por
   * conversación, así que borrar el chat donde se hizo el cuestionario no
   * obliga a repetirlo. Los informes ya emitidos tampoco: D13 del ADR-019.
   */
  deleteThread(threadId: string): Observable<void> {
    if (environment.useMocks) return of(mockDelete(threadId));

    return this.http.delete<void>(`${environment.agentUrl}/threads/${threadId}`);
  }

  /**
   * Historial de la conversacion, para repoblar el chat al recargar.
   *
   * Trae tambien si hay un turno generandose ahora mismo: desde que el turno
   * sobrevive a que cierres la pestaña, volver a entrar puede pillarlo a
   * medias, y sin saberlo la pantalla enseñaria la pregunta sin respuesta.
   */
  loadHistory(threadId: string): Observable<ThreadHistory> {
    // El mock devuelve la forma de la RESPUESTA y se traduce igual que la de
    // verdad, con el mismo `toChatMessage`. Devolver aquí `ChatMessage[]` ya
    // hechos dejaría sin ejercitar en local justo el trozo que traduce.
    if (environment.useMocks) return of(toThreadHistory(mockHistory(threadId)));

    return this.http
      .get<ThreadMessagesResponse>(`${environment.agentUrl}/threads/${threadId}/messages`)
      .pipe(map(toThreadHistory));
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

    const esDeUnSubagente = filtroDeSubagentes();

    for await (const event of this.agent.streamRun(input, signal)) {
      if (esDeUnSubagente(event)) continue;

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
/**
 * Reconoce la narración interna de un subagente, para no pintarla.
 *
 * El agente emite `spark.subagent.start` y `spark.subagent.end` alrededor de
 * cada delegación, y entre esos dos eventos el texto que llega lo escribe el
 * subagente, no el coordinador. Es texto de trabajo: habla del estudiante en
 * tercera persona —«el estudiante mencionó», «voy a emitir el informe para
 * este estudiante»— porque va dirigido a quien delegó. Se pintaba en el chat
 * como si fueran respuestas del orientador.
 *
 * Devuelve una función con memoria en vez de recibir el estado por parámetro:
 * lo que hay que recordar entre eventos —cuántas delegaciones siguen abiertas
 * y qué mensajes se silenciaron— es asunto suyo y de nadie más.
 *
 * Se apunta el **id** de cada mensaje silenciado, y no basta el contador: el
 * cierre de la delegación y el del mensaje no llevan orden garantizado, así
 * que un `TEXT_MESSAGE_END` que llegara después abriría una burbuja vacía.
 */
function filtroDeSubagentes(): (event: AgUiEvent) => boolean {
  let delegacionesAbiertas = 0;
  const silenciados = new Set<string>();

  return (event) => {
    if (event.type === 'CUSTOM') {
      if (event.name === SUBAGENT_START_EVENT) delegacionesAbiertas++;
      if (event.name === SUBAGENT_END_EVENT)
        delegacionesAbiertas = Math.max(0, delegacionesAbiertas - 1);
      return false;
    }

    const messageId = String(event.messageId ?? '');
    if (event.type === 'TEXT_MESSAGE_START' && delegacionesAbiertas > 0) {
      silenciados.add(messageId);
      return true;
    }
    if (event.type === 'TEXT_MESSAGE_CONTENT') return silenciados.has(messageId);
    if (event.type === 'TEXT_MESSAGE_END' && silenciados.has(messageId)) {
      silenciados.delete(messageId);
      return true;
    }
    return false;
  };
}

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
    return;
  }
  if (event.name === REPORT_READY_EVENT) {
    // El id se exige: sin él no hay nada que enlazar, y un botón que lleva a
    // ninguna parte es peor que no tener botón.
    const reportId = asText(value['reportId']);
    if (reportId) handlers.onReportReady(reportId);
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

/**
 * La respuesta del endpoint, traducida a lo que pinta la pantalla.
 *
 * `running` por defecto en false: un agente anterior a
 * `spark-match-08-deep-agent#88` no manda el campo, y ausencia no es «hay un
 * turno corriendo» — dar por cierto lo contrario dejaria la pantalla clavada
 * en «respondiendo» contra un agente que nunca va a decir que termino.
 */
function toThreadHistory(response: Partial<ThreadMessagesResponse>): ThreadHistory {
  return {
    messages: (response.messages ?? []).map(toChatMessage),
    running: response.running === true,
  };
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
