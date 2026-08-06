/**
 * Los eventos del protocolo AG-UI que esta app consume.
 *
 * El agente (`spark-match-08-deep-agent`) responde a `POST /ag-ui` con un
 * stream SSE de eventos tipados. Emite mas tipos de los que hay aqui: se
 * declaran solo los que la UI usa, y el cliente ignora el resto en vez de
 * romperse, para que agregar uno nuevo del lado del agente nunca tumbe al
 * frontend.
 *
 * Nota sobre lo que NO aparece: el agente filtra los eventos `RAW` antes de
 * emitirlos, porque llevaban los prompts internos al navegador. Si alguna
 * vez vuelven a aparecer, no los uses: son internals, no contrato.
 */

export type AgUiEventType =
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'STEP_STARTED'
  | 'STEP_FINISHED'
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'MESSAGES_SNAPSHOT'
  | 'STATE_SNAPSHOT';

export interface AgUiEvent {
  /** Uno de `AgUiEventType`, o cualquier otro que el agente agregue despues. */
  type: string;
  /** STEP_STARTED / STEP_FINISHED: nombre del nodo del grafo. */
  stepName?: string;
  /** TEXT_MESSAGE_CONTENT: el fragmento de texto que se acaba de generar. */
  delta?: string;
  /** TEXT_MESSAGE_*: identifica el mensaje que se esta componiendo. */
  messageId?: string;
  /** RUN_ERROR. */
  message?: string;
  [key: string]: unknown;
}

/** Lo que el agente espera en el cuerpo de `POST /ag-ui` (`RunAgentInput`). */
export interface RunAgentInput {
  threadId: string;
  runId: string;
  state: Record<string, unknown>;
  messages: { id: string; role: 'user' | 'assistant'; content: string }[];
  tools: unknown[];
  context: unknown[];
  forwardedProps: Record<string, unknown>;
}
