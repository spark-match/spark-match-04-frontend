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
  /**
   * En este turno se emitió un informe, y aquí va su id.
   *
   * Se guarda en el mensaje y no sólo en pantalla mientras corre, por lo
   * mismo que las actividades: el estudiante puede volver a la conversación
   * mañana y el enlace a su informe tiene que seguir donde lo dejó.
   */
  reportId?: string;
}

export interface ChatSession {
  id: string;
  filters: OrientationFilters | null;
  messages: ChatMessage[];
}

/**
 * Una llamada a herramienta tal como la devuelve el historial del agente.
 *
 * No es `ChatActivity`: aquí no hay etiquetas ni motivos, sólo el nombre de
 * la herramienta y —cuando la lista blanca del agente lo autoriza— con qué se
 * llamó. La copia en castellano se pone en el frontend (`tool-labels.ts`,
 * `subagent-labels.ts`), igual que con el turno en vivo, para que cambiarla no
 * obligue a desplegar el agente.
 */
export interface ThreadActivity {
  /** El `toolCallId`, el mismo que viaja por el stream. */
  id: string;
  tool: string;
  /** `null` en un turno que se cortó antes de saber el resultado. */
  ok: boolean | null;
  /** Clave del especialista. Sólo en la herramienta de delegación. */
  subagent?: string;
  /** Con qué se llamó: la consulta, la carrera. Ausente si no es publicable. */
  subject?: string;
}

/** Un mensaje del historial, tal como viaja por HTTP. */
export interface ThreadMessage {
  id?: string | null;
  role: string;
  content: string;
  /**
   * Las herramientas del turno, sólo en el mensaje que lo cierra.
   *
   * La manda el agente desde `spark-match-08-deep-agent#86`. Sin esto, al
   * recargar la página la respuesta se quedaba sin procedencia: las mismas
   * cifras, y ninguna pista de si salieron del catálogo del MINEDU, de una
   * búsqueda en internet o de un especialista.
   */
  activity?: ThreadActivity[];
}

/** Forma de `GET /threads/{id}/messages` en el agente. */
export interface ThreadMessagesResponse {
  thread_id: string;
  messages: ThreadMessage[];
  /**
   * Hay un turno generándose ahora mismo en esta conversación.
   *
   * Lo manda el agente desde `spark-match-08-deep-agent#88`. Desde que el
   * turno sobrevive a que cierres la pestaña (#89), volver a entrar puede
   * pillarlo a medias: sin este campo el estudiante vería su pregunta sin
   * respuesta, la repetiría, y se llevaría un 409.
   */
  running?: boolean;
}

/** El historial de una conversación y si sigue viva. */
export interface ThreadHistory {
  messages: ChatMessage[];
  running: boolean;
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
  /**
   * El agente empezo a usar una herramienta (buscar en internet, etc).
   *
   * `kind` viaja desde aqui y no lo deduce la pantalla: quien sabe si un
   * nombre de herramienta sale a internet es el mapa de `tool-labels.ts`, y
   * repetir ese criterio en el componente serian dos sitios que se separan.
   */
  onToolStart(toolCallId: string, label: string, reason: string, kind: ChatActivityKind): void;
  /**
   * Con qué se llamó a esa herramienta.
   *
   * Llega despues del START y no con él: los argumentos los dicta el modelo
   * token a token (`TOOL_CALL_ARGS`), asi que hasta que no termina de
   * dictarlos no hay un JSON que se pueda leer.
   */
  onToolDetail(toolCallId: string, detail: string): void;
  /** Esa herramienta termino. */
  onToolEnd(toolCallId: string): void;
  /** El coordinador delegó en un especialista. Mismo id que la tool `task`. */
  onSubagentStart(toolCallId: string, label: string, reason: string): void;
  /** El especialista terminó. `ok` es false si la delegación falló. */
  onSubagentEnd(toolCallId: string, ok: boolean, durationMs: number): void;
  /** Se emitió un informe y ya se puede abrir. */
  onReportReady(reportId: string): void;
  /** El hilo completo tal como lo tiene el checkpoint del agente. */
  onSnapshot(messages: AgUiSnapshotMessage[]): void;
}

/** De qué es el chip: una herramienta o una delegación en un especialista. */
/**
 * `search` sale de `tool` a propósito, y no es un matiz estético.
 *
 * Todo lo demás que hace el agente sale de un dataset fechado del MINEDU que
 * se puede citar; una búsqueda sale de la web de hoy, que no ha revisado
 * nadie. Poder distinguir de un vistazo cuál de las dos está detrás de una
 * frase es una cuestión de cuánto fiarse de ella.
 */
export type ChatActivityKind = 'subagent' | 'search' | 'tool';

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
  /**
   * Con qué se llamó: «ingeniería» · en Áncash. Sale de los argumentos de la
   * llamada, filtrados por `tool-details.ts`. Vacío si no hay nada que se
   * pueda enseñar.
   */
  detail?: string;
  /** Para qué sirve esa herramienta, en una frase. */
  reason?: string;
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
