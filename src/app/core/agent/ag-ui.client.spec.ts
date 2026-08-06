import { readSseEvents } from './ag-ui.client';

/**
 * Los chunks de un `ReadableStream` no respetan las fronteras de los frames
 * SSE, asi que el parser tiene que reconstruirlos. Estos tests entregan el
 * stream troceado a proposito, incluso partiendo un JSON por la mitad, que es
 * exactamente lo que pasa con una respuesta larga en produccion.
 */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = [];
  for await (const event of readSseEvents(stream)) events.push(event);
  return events;
}

describe('readSseEvents', () => {
  it('parses one event per frame', async () => {
    const events = await collect(
      streamOf('data: {"type":"RUN_STARTED"}\n\ndata: {"type":"RUN_FINISHED"}\n\n'),
    );

    expect(events.map((e) => e.type)).toEqual(['RUN_STARTED', 'RUN_FINISHED']);
  });

  it('reassembles a frame split across chunks', async () => {
    const events = await collect(
      streamOf('data: {"type":"TEXT_MESSA', 'GE_CONTENT","delta":"hola"}', '\n\n'),
    );

    expect(events).toEqual([{ type: 'TEXT_MESSAGE_CONTENT', delta: 'hola' }]);
  });

  it('reassembles a frame split mid-word across many chunks', async () => {
    const payload = 'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"orientación vocacional"}\n\n';
    // [\s\S] y no `.`: el punto no matchea saltos de linea, asi que troceando
    // con /./ el `\n\n` final se cae y el frame nunca cierra.
    const chunks = payload.match(/[\s\S]{1,7}/g) as string[];

    const events = await collect(streamOf(...chunks));

    expect(events[0].delta).toBe('orientación vocacional');
  });

  it('ignores keep-alive comments', async () => {
    // El agente emite `: ping` cada 15s para que CloudFront no corte un turno
    // lento por inactividad. Por spec SSE son comentarios y no despachan nada.
    const events = await collect(
      streamOf(': ping\n\n', 'data: {"type":"RUN_STARTED"}\n\n', ': ping\n\n'),
    );

    expect(events.map((e) => e.type)).toEqual(['RUN_STARTED']);
  });

  it('skips a malformed frame instead of killing the stream', async () => {
    const events = await collect(
      streamOf('data: {no es json\n\n', 'data: {"type":"RUN_FINISHED"}\n\n'),
    );

    expect(events.map((e) => e.type)).toEqual(['RUN_FINISHED']);
  });

  it('ignores a trailing frame with no blank line', async () => {
    // Un stream cortado a la mitad no debe emitir un evento incompleto.
    const events = await collect(
      streamOf('data: {"type":"RUN_STARTED"}\n\ndata: {"type":"TEXT_ME'),
    );

    expect(events.map((e) => e.type)).toEqual(['RUN_STARTED']);
  });

  it('joins multi-line data fields', async () => {
    const events = await collect(streamOf('data: {"type":\ndata: "RUN_STARTED"}\n\n'));

    expect(events.map((e) => e.type)).toEqual(['RUN_STARTED']);
  });

  it('yields nothing for an empty stream', async () => {
    expect(await collect(streamOf())).toEqual([]);
  });
});
