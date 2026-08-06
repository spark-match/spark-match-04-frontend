/**
 * Contrato del chat de orientación.
 *
 * Ya no es inventado: `ChatMessage` es lo que devuelve el agente en
 * `GET /threads/{id}/messages`, y el turno en vivo llega por SSE desde
 * `POST /ag-ui` (ver `src/app/core/agent/`).
 */
import { OrientationFilters } from '../filters/filters.model';

export type ChatRole = 'ai' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** ISO 8601 */
  timestamp: string;
  /** Indica que el agente terminó su propuesta de carreras y habilita la valoración. */
  isFinalRecommendation?: boolean;
  /** Marca la burbuja que se está escribiendo ahora mismo, token a token. */
  streaming?: boolean;
}

export interface ChatSession {
  id: string;
  filters: OrientationFilters | null;
  messages: ChatMessage[];
}

/** Forma de `GET /threads/{id}/messages` en el agente. */
export interface ThreadMessagesResponse {
  thread_id: string;
  messages: { id?: string | null; role: string; content: string }[];
}

/**
 * Lo que pasa durante un turno, separado por tipo de evento.
 *
 * `onStep` puede dispararse varias veces antes de `onAnswerStart`: son los
 * pasos intermedios que el agente va anunciando mientras piensa.
 */
export interface ChatTurnHandlers {
  onStep(label: string): void;
  onAnswerStart(): void;
  onDelta(delta: string): void;
}

/** Una conversación en la lista del sidebar (`GET /threads` del agente). */
export interface ChatThread {
  /** El id del lado del cliente: con el se reabre la conversación. */
  thread_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadsResponse {
  threads: ChatThread[];
}
