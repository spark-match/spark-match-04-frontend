import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AgUiClient } from '../../core/agent/ag-ui.client';
import { stepLabel } from '../../core/agent/step-labels';
import { RunAgentInput } from '../../core/agent/ag-ui.model';
import { ChatMessage, ChatTurnHandlers, ThreadMessagesResponse } from './chat.model';

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
  private http = inject(HttpClient);
  private agent = inject(AgUiClient);

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

  /** Historial de la conversacion, para repoblar el chat al recargar. */
  loadHistory(threadId: string): Observable<ChatMessage[]> {
    if (environment.useMocks) return of([]);

    return this.http
      .get<ThreadMessagesResponse>(`${environment.agentUrl}/threads/${threadId}/messages`)
      .pipe(map((response) => (response.messages ?? []).map(toChatMessage)));
  }

  /**
   * Envia un turno y va notificando lo que pasa mientras el agente trabaja.
   *
   * Devuelve callbacks en vez de un Observable porque un turno no es un
   * valor: son tres cosas distintas ocurriendo a la vez — texto que crece,
   * pasos que cambian, y un final. Meter todo en un `Observable<ChatMessage>`
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

    for await (const event of this.agent.streamRun(input, signal)) {
      switch (event.type) {
        case 'STEP_STARTED': {
          // Un paso sin etiqueta conocida no cambia nada en pantalla: es
          // fontaneria del grafo, no algo que el estudiante deba leer.
          const label = stepLabel(event.stepName);
          if (label) handlers.onStep(label);
          break;
        }
        case 'TEXT_MESSAGE_START':
          handlers.onAnswerStart();
          break;
        case 'TEXT_MESSAGE_CONTENT':
          if (event.delta) handlers.onDelta(event.delta);
          break;
        case 'RUN_ERROR':
          throw new Error(event.message ?? 'run error');
        default:
          break;
      }
    }
  }
}

function toChatMessage(message: {
  id?: string | null;
  role: string;
  content: string;
}): ChatMessage {
  return {
    id: message.id ?? crypto.randomUUID(),
    role: message.role === 'user' ? 'user' : 'ai',
    text: message.content,
    // El agente no persiste timestamps por mensaje. Se usa el momento de la
    // carga para no inventar una hora que parezca real y no lo sea.
    timestamp: new Date().toISOString(),
  };
}
