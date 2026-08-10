/**
 * Conversaciones simuladas, para trabajar el chat sin desplegar.
 *
 * `ag-ui.mock-stream.ts` cubrió el turno en vivo; esto cubre lo otro que hace
 * el chat y que en local no existía: la lista del sidebar y el historial al
 * recargar. Con `useMocks` en true, `listThreads()` y `loadHistory()`
 * devolvían `of([])` — así que en local el sidebar salía siempre vacío, y una
 * conversación recargada siempre empezaba de cero. Lo que va de rehidratar
 * una conversación sólo se podía mirar desplegando a dev y hablando con el
 * agente real, que es trabajo a ciegas para una pantalla cuyo tema es
 * justamente lo que ya pasó.
 *
 * ## Devuelve la forma DE LA RESPUESTA, no la del dominio
 *
 * `mockHistory()` devuelve `ThreadMessage[]`, o sea lo que hay en el cuerpo
 * de `GET /threads/{id}/messages`, y no `ChatMessage[]`. Es deliberado: si el
 * mock devolviera el objeto ya traducido, el único código que no correría
 * nunca en local sería precisamente el que traduce — que es el que se está
 * desarrollando. Un mock tiene que sustituir al servidor, no al servicio.
 *
 * ## Las fechas se calculan
 *
 * `relativeDayLabel` distingue «Hoy», «Ayer», «Hace 3 días» y, a partir del
 * mes, una fecha corta. Con fechas literales el fixture envejece hasta
 * «Hace 200 días» y deja de ejercitar las tres primeras ramas justo cuando
 * alguien las toca. Así que se calculan contra el momento de la llamada.
 */
import { ChatThread, ThreadActivity, ThreadMessage, ThreadMessagesResponse } from './chat.model';

/** Un día en milisegundos. */
const DIA = 86_400_000;

function haceDias(dias: number, hora = 16): string {
  const fecha = new Date(Date.now() - dias * DIA);
  fecha.setHours(hora, 30, 0, 0);
  return fecha.toISOString();
}

/**
 * El título tal como lo arma el agente: el primer mensaje del estudiante,
 * colapsado y recortado a 60 (`threads/registry.py`, `build_title`).
 *
 * Se replica la regla en vez de escribir títulos bonitos a mano porque el
 * sidebar en local tiene que verse como el de verdad, y el de verdad son
 * frases cortadas. Que se note es la gracia: es la razón por la que renombrar
 * una conversación está en la lista de pendientes.
 */
const MAX_TITULO = 60;

function titulo(primerMensaje: string): string {
  const plano = primerMensaje.trim().replaceAll(/\s+/g, ' ');
  return plano.length <= MAX_TITULO ? plano : `${plano.slice(0, MAX_TITULO - 1).trimEnd()}…`;
}

/** Atajos para que las conversaciones de abajo se lean como conversaciones. */
function usuario(id: string, content: string): ThreadMessage {
  return { id, role: 'user', content };
}

function asistente(id: string, content: string, activity?: ThreadActivity[]): ThreadMessage {
  return activity
    ? { id, role: 'assistant', content, activity }
    : { id, role: 'assistant', content };
}

/**
 * Sin `subject` cuando no lo hay, en vez de con la clave puesta a vacío: el
 * agente omite el campo, y un `subject: ''` sería una forma que el endpoint
 * no produce nunca.
 */
function llamada(
  id: string,
  tool: string,
  subject?: string,
  ok: boolean | null = true,
): ThreadActivity {
  return subject ? { id, tool, ok, subject } : { id, tool, ok };
}

function delegacion(id: string, subagent: string, ok: boolean | null = true): ThreadActivity {
  return { id, tool: 'task', ok, subagent };
}

/** Lo que devuelve el endpoint del historial, sin el `thread_id`. */
type ThreadHistoryResponse = Pick<ThreadMessagesResponse, 'messages' | 'running'>;

/** La conversación que se abre a medio turno. Ver `elHiloEnCurso`. */
const HILO_EN_CURSO = 'mock-hilo-en-curso';

const EN_CURSO_PREGUNTA = usuario(
  'mock-5-u1',
  '¿Cuánto cuesta estudiar Medicina en una universidad privada de Lima?',
);

const EN_CURSO_RESPUESTA = asistente(
  'mock-5-a1',
  'Medicina es de las carreras más caras del país, y la horquilla es amplia.\n\n' +
    'En privadas de Lima el costo anual va de **S/ 18.000** a **S/ 47.000**, y son ' +
    '**siete años** en vez de cinco. En la **UNMSM** o la **UNFV**, públicas, la pensión ' +
    'es S/ 0 — pero la admisión ronda el 6%.\n\n' +
    '¿Quieres que mire cuánto sale el total de la carrera en cada caso?',
  [
    llamada('mock-5-t1', 'search_careers', 'medicina humana'),
    llamada('mock-5-t2', 'search_programs', 'Medicina Humana'),
    delegacion('mock-5-t3', 'matching'),
  ],
);

/**
 * Las conversaciones, con lo que cada una existe para enseñar.
 *
 * No son charlas de relleno: entre todas está cada caso que la pantalla tiene
 * que saber pintar y que de otro modo sólo se ve en producción, y con suerte.
 */
const CONVERSACIONES: readonly { id: string; dias: number; mensajes: ThreadMessage[] }[] = [
  {
    // Esta se abre a medio turno: ver `elHiloEnCurso`. Va primera porque su
    // turno está ocurriendo ahora mismo. En el sidebar sale como cualquier
    // otra, y sólo al entrar se nota que el agente sigue escribiendo.
    id: HILO_EN_CURSO,
    dias: 0,
    mensajes: [EN_CURSO_PREGUNTA, EN_CURSO_RESPUESTA],
  },
  {
    // La gorda. Cubre: varias llamadas seguidas a la misma herramienta
    // (agrupación con contador), una búsqueda en internet, DOS especialistas
    // en el mismo turno, un fallo, y un turno sin actividad ninguna.
    id: 'mock-hilo-industrial',
    dias: 0,
    mensajes: [
      usuario(
        'mock-1-u1',
        'Hola, estoy entre ingeniería industrial y administración y no sé cuál me conviene',
      ),
      asistente(
        'mock-1-a1',
        'Buena duda, y son más parecidas de lo que parece.\n\n' +
          '**Ingeniería Industrial** está en 41 universidades del país y mezcla análisis ' +
          'cuantitativo con gestión de procesos. **Administración** aparece en muchas más ' +
          'instituciones y entra antes al trabajo, con menos carga matemática.\n\n' +
          '¿Qué te gusta más: entender por qué algo falla, o coordinar a la gente que lo arregla?',
        [
          llamada('mock-1-t1', 'search_careers', 'ingeniería industrial'),
          llamada('mock-1-t2', 'search_careers', 'administración de empresas'),
          llamada('mock-1-t3', 'search_careers', 'gestión y alta dirección'),
          llamada('mock-1-t4', 'web_search', 'empleabilidad ingeniería industrial Perú 2026'),
        ],
      ),
      usuario(
        'mock-1-u2',
        'Me gusta más entender por qué falla. ¿Dónde la puedo estudiar en Arequipa?',
      ),
      asistente(
        'mock-1-a2',
        'Eso apunta a un perfil **SEC** —analítico, con trato con personas y orden—, ' +
          'y encaja bien con Industrial.\n\n' +
          'En Arequipa la tienes en la **UNSA** (pública, S/ 0 de pensión, admisión ~13%) ' +
          'y en la **UCSM** (privada, S/ 11.400 al año, admisión ~62%).\n\n' +
          '¿Te miro cuánto tardan y qué tan difícil es entrar a cada una?',
        [
          delegacion('mock-1-t5', 'assessment'),
          delegacion('mock-1-t6', 'matching'),
          llamada('mock-1-t7', 'recommend_programs', 'SEC'),
          llamada('mock-1-t8', 'search_programs', 'Ingeniería Industrial'),
        ],
      ),
      usuario('mock-1-u3', '¿Y hay alguna beca para la UCSM?'),
      asistente(
        'mock-1-a3',
        'No pude comprobarlo ahora mismo: la búsqueda falló.\n\n' +
          'Lo que sí te puedo decir con los datos que tengo es que la UCSM cobra ' +
          'S/ 11.400 al año. Para becas, Pronabec es el camino habitual y conviene ' +
          'mirarlo en su portal, que cambia cada convocatoria.',
        // Un fallo, y solo. Con un grupo la lista no se pliega, así que
        // también cubre cómo se ve una actividad corta sin desplegable.
        [llamada('mock-1-t9', 'web_search', 'becas UCSM 2026', false)],
      ),
      usuario('mock-1-u4', 'Ya, gracias'),
      // Sin actividad: hay turnos que no usan ninguna herramienta, y el hueco
      // tiene que quedar limpio en vez de dejar una lista vacía ocupando sitio.
      asistente('mock-1-a4', 'A ti. Cuando quieras seguimos con las fechas de admisión.'),
    ],
  },
  {
    // Una herramienta fuera de la lista blanca del agente: llega sin
    // `subject`, y el chip tiene que salir igual, sólo que mudo.
    id: 'mock-hilo-salud',
    dias: 1,
    mensajes: [
      usuario('mock-2-u1', 'Quiero algo de salud pero no medicina, me da miedo la sangre'),
      asistente(
        'mock-2-a1',
        'Hay bastante camino en salud sin quirófano: **Psicología**, **Nutrición**, ' +
          '**Tecnología Médica** en sus ramas de laboratorio o imágenes, y **Terapia Física**.\n\n' +
          'Me quedo con que prefieres no operar. ¿Te llama más el trato directo con el ' +
          'paciente o el trabajo de análisis?',
        [
          llamada('mock-2-t1', 'search_careers', 'psicología'),
          llamada('mock-2-t2', 'search_careers', 'nutrición'),
          llamada('mock-2-t3', 'manage_memory'),
        ],
      ),
    ],
  },
  {
    id: 'mock-hilo-becas',
    dias: 4,
    mensajes: [
      usuario('mock-3-u1', 'Mis papás no pueden pagarme la universidad, ¿qué opciones tengo?'),
      asistente(
        'mock-3-a1',
        'Hay tres caminos y no se excluyen: **universidad pública** (S/ 0 de pensión, ' +
          'admisión más dura), **Beca 18 de Pronabec**, y los **institutos**, que duran ' +
          'tres años en vez de cinco y cuestan bastante menos.\n\n' +
          '¿En qué departamento estás? Con eso te digo qué tienes cerca.',
        [
          llamada('mock-3-t1', 'web_search', 'Beca 18 Pronabec requisitos'),
          llamada('mock-3-t2', 'web_search', 'convocatoria Beca 18 2026 fechas'),
          llamada('mock-3-t3', 'search_programs', 'institutos públicos'),
        ],
      ),
    ],
  },
  {
    // Vieja a propósito: es la única que enseña la cuarta rama de
    // `relativeDayLabel`, la fecha corta.
    id: 'mock-hilo-antiguo',
    dias: 45,
    mensajes: [
      usuario('mock-4-u1', 'hola'),
      asistente('mock-4-a1', '¡Hola! ¿Por dónde empezamos?'),
    ],
  },
];

/**
 * Las conversaciones del sidebar, más recientes primero.
 *
 * `ChatThread` ya es la forma de la respuesta —`thread_id`, `created_at`: eso
 * viene tal cual del agente—, así que aquí no hace falta un tipo aparte como
 * con los mensajes.
 */
export function mockThreads(): ChatThread[] {
  return CONVERSACIONES.map((conversacion) => ({
    thread_id: conversacion.id,
    title: titulo(conversacion.mensajes[0].content),
    created_at: haceDias(conversacion.dias, 9),
    updated_at: haceDias(conversacion.dias),
  }));
}

/**
 * Cuántos sondeos tarda el hilo en curso en contestar.
 *
 * Tres es lo justo para ver el aviso puesto, el sondeo repitiéndose y la
 * respuesta aterrizando. Con uno solo no daría tiempo a mirarlo.
 */
const SONDEOS_HASTA_RESPONDER = 3;

let sondeosDelHiloEnCurso = 0;

/**
 * Devuelve el hilo en curso a su estado inicial.
 *
 * El contador es estado, y estado en un mock normalmente es mala señal. Este
 * se lo gana: el turno que sigue vivo al volver a entrar es justo lo que no
 * se podía mirar en local, y sin que la respuesta acabe llegando lo que se
 * probaría es una pantalla clavada, que es el fallo y no el arreglo. Los
 * tests lo reinician entre casos.
 */
export function reiniciarElHiloEnCurso(): void {
  sondeosDelHiloEnCurso = 0;
}

function elHiloEnCurso(): ThreadHistoryResponse {
  sondeosDelHiloEnCurso += 1;
  if (sondeosDelHiloEnCurso < SONDEOS_HASTA_RESPONDER) {
    // La pregunta ya está en el checkpoint; la respuesta todavía no. Es
    // exactamente lo que se ve al volver a una conversación a medio turno.
    return { messages: [EN_CURSO_PREGUNTA], running: true };
  }
  return { messages: [EN_CURSO_PREGUNTA, EN_CURSO_RESPUESTA], running: false };
}

/**
 * El historial de una conversación simulada. Vacío si no es una de ellas.
 *
 * Que un id desconocido dé una lista vacía no es un descuido: es lo que hace
 * el endpoint de verdad, y es lo que mantiene «nueva conversación» funcionando
 * en local. Al abrir la app por primera vez el id es un UUID recién creado,
 * así que se entra a un chat limpio; las de arriba se abren desde el sidebar.
 */
export function mockHistory(threadId: string): ThreadHistoryResponse {
  if (threadId === HILO_EN_CURSO) return elHiloEnCurso();

  // Salir de la conversación la vuelve a armar, para que entrar otra vez
  // enseñe el turno a medias en lugar de la respuesta ya puesta. Sin esto
  // sólo se puede ver una vez por carga de página, y lo que se está
  // desarrollando —una espera de seis segundos— hay que poder mirarlo más
  // de una vez seguida. En el agente de verdad no pasa: allí un turno
  // terminado se queda terminado.
  reiniciarElHiloEnCurso();

  const conversacion = CONVERSACIONES.find((c) => c.id === threadId);
  return { messages: conversacion?.mensajes ?? [], running: false };
}
