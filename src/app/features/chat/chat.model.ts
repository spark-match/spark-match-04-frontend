/**
 * Contrato del chat de orientación.
 *
 * Ya no es inventado: `ChatMessage` es lo que devuelve el agente en
 * `GET /threads/{id}/messages`, y el turno en vivo llega por SSE desde
 * `POST /ag-ui` (ver `src/app/core/agent/`).
 */
import { AgUiSnapshotMessage } from '../../core/agent/ag-ui.model';
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
  /** Herramientas que el agente usó para producir esta respuesta. */
  activities?: ChatActivity[];
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
 *
 * Los tres de mensaje llevan `messageId` porque un turno puede producir
 * VARIAS burbujas: el coordinador escribe, delega, y vuelve a escribir. Sin
 * el id, la segunda respuesta se pegaba a la primera y las burbujas
 * anteriores se quedaban marcadas como «escribiendo» para siempre.
 */
export interface ChatTurnHandlers {
  onStep(label: string): void;
  onAnswerStart(messageId: string): void;
  onDelta(messageId: string, delta: string): void;
  /** Esa respuesta quedó completa (`TEXT_MESSAGE_END`). */
  onAnswerEnd(messageId: string): void;
  /** El agente empezo a usar una herramienta (buscar en internet, etc). */
  onToolStart(toolCallId: string, label: string): void;
  /** Esa herramienta termino. */
  onToolEnd(toolCallId: string): void;
  /** El coordinador delegó en un especialista. Mismo id que la tool `task`. */
  onSubagentStart(toolCallId: string, label: string): void;
  /** El especialista terminó. `ok` es false si la delegación falló. */
  onSubagentEnd(toolCallId: string, ok: boolean, durationMs: number): void;
  /** El hilo completo tal como lo tiene el checkpoint del agente. */
  onSnapshot(messages: AgUiSnapshotMessage[]): void;
}

/** De qué es el chip: una herramienta o una delegación en un especialista. */
export type ChatActivityKind = 'subagent' | 'tool';

/**
 * Una herramienta que el agente uso durante el turno, tal como se le muestra
 * al estudiante.
 *
 * Se guardan en el mensaje del asistente y no solo en pantalla mientras
 * corre: saber que la respuesta salio de una busqueda en internet importa
 * despues de leerla, no solo mientras se genera.
 */
export interface ChatActivity {
  id: string;
  label: string;
  running: boolean;
  kind: ChatActivityKind;
  /** Sólo en delegaciones ya terminadas. */
  durationMs?: number;
  /** `false` cuando la delegación falló. */
  ok?: boolean;
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
