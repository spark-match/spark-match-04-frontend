import { Service, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AgUiEvent, RunAgentInput } from './ag-ui.model';
import { mockTurnEvents } from './ag-ui.mock-stream';

/**
 * Cliente SSE del protocolo AG-UI.
 *
 * Por que `fetch` y no `EventSource`: el endpoint del agente es un POST con
 * cuerpo JSON y requiere `Authorization: Bearer`. `EventSource` solo hace GET
 * y no admite cabeceras propias, asi que no sirve — no es preferencia, es que
 * no puede.
 *
 * Y por eso mismo el token se pone a mano: `authInterceptor` solo intercepta
 * peticiones de `HttpClient`, y esto no pasa por ahi.
 */

export type AgentErrorKind =
  'unauthorized' | 'forbidden' | 'rate-limited' | 'budget-exhausted' | 'network' | 'agent';

export class AgentStreamError extends Error {
  constructor(
    readonly kind: AgentErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AgentStreamError';
  }
}

/** Mensaje que ve el estudiante. Nunca el detalle crudo del servidor. */
const MESSAGES: Record<AgentErrorKind, string> = {
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
  forbidden: 'Esta conversación no está disponible para tu cuenta.',
  'rate-limited': 'Vas muy rápido. Espera unos segundos y vuelve a intentarlo.',
  'budget-exhausted':
    'Alcanzaste el límite de consultas por hoy. Podrás seguir conversando mañana.',
  network: 'No pudimos conectar con el orientador. Revisa tu conexión e intenta de nuevo.',
  agent: 'El orientador tuvo un problema procesando tu mensaje. Intenta de nuevo.',
};

export function agentErrorMessage(error: unknown): string {
  return error instanceof AgentStreamError ? MESSAGES[error.kind] : MESSAGES.agent;
}

async function toStreamError(response: Response): Promise<AgentStreamError> {
  const body = await response.text().catch(() => '');

  if (response.status === 401) return new AgentStreamError('unauthorized', body, 401);
  if (response.status === 403) return new AgentStreamError('forbidden', body, 403);
  if (response.status === 429) {
    // Dos limites distintos comparten el 429 y el estudiante necesita
    // distinguirlos: uno se pasa en segundos, el otro dura hasta mañana.
    // El limitador por minuto responde {"error": "Rate limit exceeded: ..."}
    // y el presupuesto diario {"detail": "Daily request budget exceeded ..."}.
    const kind = body.includes('Daily request budget') ? 'budget-exhausted' : 'rate-limited';
    return new AgentStreamError(kind, body, 429);
  }
  return new AgentStreamError('agent', body, response.status);
}

@Service()
export class AgUiClient {
  private readonly auth = inject(AuthService);

  /**
   * Abre el stream y va emitiendo los eventos del agente conforme llegan.
   *
   * `signal` permite abortar desde el componente (el usuario cambia de
   * pantalla o cancela). Al abortar, `fetch` rechaza con `AbortError`, que se
   * deja propagar tal cual para que quien llama lo distinga de un fallo real.
   */
  async *streamRun(input: RunAgentInput, signal?: AbortSignal): AsyncGenerator<AgUiEvent> {
    // El único sitio del chat donde `useMocks` no llegaba. Sin esto, en local
    // el chat no respondía nunca — `fetch` salía a un agente que no está — y
    // los chips de actividad no se podían ver en absoluto: había que
    // desplegar a dev para mirarlos. Ver `ag-ui.mock-stream.ts`.
    if (environment.useMocks) {
      yield* mockTurnEvents(input, signal);
      return;
    }

    const token = this.auth.token();
    if (!token) {
      throw new AgentStreamError('unauthorized', 'no token in storage', 401);
    }

    let response: Response;
    try {
      response = await fetch(`${environment.agentUrl}/ag-ui`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new AgentStreamError('network', String(error));
    }

    if (!response.ok) throw await toStreamError(response);
    if (!response.body) throw new AgentStreamError('network', 'response had no body');

    yield* readSseEvents(response.body);
  }
}

/**
 * Parsea el cuerpo SSE en eventos.
 *
 * Un frame termina en linea en blanco, y los chunks del `ReadableStream` no
 * respetan esa frontera: uno puede cortar un JSON por la mitad. De ahi el
 * buffer — sin el, un mensaje largo se rompe en cuanto no cabe en un chunk.
 *
 * Las lineas que empiezan con ':' son comentarios por spec y se descartan;
 * ahi viajan los keep-alive que el agente emite cada 15s para que CloudFront
 * no corte un turno lento por inactividad.
 */
export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AgUiEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(frame);
        if (event) yield event;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    // Corta el turno en el servidor cuando quien consume se va a mitad de
    // stream, en vez de dejar al agente generando contra nadie.
    reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function parseFrame(frame: string): AgUiEvent | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');

  if (!data) return null;

  try {
    return JSON.parse(data) as AgUiEvent;
  } catch {
    // Un frame ilegible no justifica tumbar la conversacion entera.
    return null;
  }
}
