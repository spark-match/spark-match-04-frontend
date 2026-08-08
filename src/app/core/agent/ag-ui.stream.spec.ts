import { TestBed } from '@angular/core/testing';

import { AgUiClient, AgentStreamError, agentErrorMessage } from './ag-ui.client';
import { AgUiEvent, RunAgentInput } from './ag-ui.model';
import { AuthService } from '../auth/auth.service';

const INPUT: RunAgentInput = {
  threadId: 't-1',
  runId: 'r-1',
  state: {},
  messages: [{ id: 'm1', role: 'user', content: 'hola' }],
  tools: [],
  context: [],
  forwardedProps: {},
};

function sseResponse(body: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function build(token: string | null = 'jwt-abc'): AgUiClient {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AuthService, useValue: { token: () => token } }],
  });
  return TestBed.inject(AgUiClient);
}

async function drain(client: AgUiClient): Promise<AgUiEvent[]> {
  const events: AgUiEvent[] = [];
  for await (const event of client.streamRun(INPUT)) events.push(event);
  return events;
}

describe('AgUiClient.streamRun', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the agent with the bearer token attached by hand', async () => {
    // authInterceptor solo intercepta HttpClient; esto va por fetch, asi que
    // si el token no se pone aca no se pone en ningun lado.
    fetchMock.mockResolvedValue(sseResponse('data: {"type":"RUN_FINISHED"}\n\n'));

    await drain(build('jwt-abc'));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/ag-ui');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-abc');
    expect(init.headers.Accept).toBe('text/event-stream');
  });

  it('yields the events of the stream', async () => {
    fetchMock.mockResolvedValue(
      sseResponse('data: {"type":"RUN_STARTED"}\n\ndata: {"type":"RUN_FINISHED"}\n\n'),
    );

    const events = await drain(build());

    expect(events.map((e) => e.type)).toEqual(['RUN_STARTED', 'RUN_FINISHED']);
  });

  it('fails as unauthorized when there is no token, without calling the agent', async () => {
    await expect(drain(build(null))).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps 401 to unauthorized', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));

    await expect(drain(build())).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('maps 403 to forbidden', async () => {
    fetchMock.mockResolvedValue(new Response('not yours', { status: 403 }));

    await expect(drain(build())).rejects.toMatchObject({ kind: 'forbidden', status: 403 });
  });

  it('separates the burst limit from the daily budget, both 429', async () => {
    // Uno se pasa en segundos, el otro dura hasta mañana: el estudiante
    // necesita que le digan cosas distintas.
    fetchMock.mockResolvedValue(
      new Response('{"error":"Rate limit exceeded: 5 per 1 minute"}', { status: 429 }),
    );
    await expect(drain(build())).rejects.toMatchObject({ kind: 'rate-limited' });

    fetchMock.mockResolvedValue(
      new Response('{"detail":"Daily request budget exceeded (200 per day)."}', { status: 429 }),
    );
    await expect(drain(build())).rejects.toMatchObject({ kind: 'budget-exhausted' });
  });

  it('maps any other server status to an agent failure', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(drain(build())).rejects.toMatchObject({ kind: 'agent', status: 500 });
  });

  it('maps a transport failure to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(drain(build())).rejects.toMatchObject({ kind: 'network' });
  });

  it('lets an abort propagate untouched so the caller can tell it apart', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await expect(drain(build())).rejects.toThrow(DOMException);
  });

  it('treats a bodyless response as a network problem', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(drain(build())).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('agentErrorMessage', () => {
  it('speaks to the student, never in server jargon', () => {
    const message = agentErrorMessage(
      new AgentStreamError('rate-limited', 'Rate limit exceeded: 5 per 1 minute', 429),
    );

    expect(message).toContain('Espera unos segundos');
    expect(message).not.toContain('Rate limit');
  });

  it('falls back to a generic message for anything unrecognised', () => {
    expect(agentErrorMessage(new Error('algo raro'))).toContain('Intenta de nuevo');
  });
});
