import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { AuthService } from '../../core/auth/auth.service';
import { ChatMessage, ChatTurnHandlers } from './chat.model';
import { AgentStreamError } from '../../core/agent/ag-ui.client';
import { ChatSessionsStore } from './chat-sessions.store';

/**
 * El turno no devuelve un valor: emite pasos, arranca la respuesta y va
 * soltando texto. Este stub reproduce esa secuencia para poder afirmar sobre
 * lo que ve el estudiante mientras el agente trabaja, no solo al final.
 */
function turnThatStreams(steps: string[], chunks: string[]) {
  return vi.fn(async (_thread: string, _text: string, handlers: ChatTurnHandlers) => {
    for (const step of steps) handlers.onStep(step);
    handlers.onAnswerStart('m-1');
    for (const chunk of chunks) handlers.onDelta('m-1', chunk);
    handlers.onAnswerEnd('m-1');
  });
}

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let chatStub: {
    currentThreadId: ReturnType<typeof vi.fn>;
    startNewThread: ReturnType<typeof vi.fn>;
    rememberThread: ReturnType<typeof vi.fn>;
    loadHistory: ReturnType<typeof vi.fn>;
    sendTurn: ReturnType<typeof vi.fn>;
  };
  let sessionsStub: { refresh: ReturnType<typeof vi.fn> };
  /** El :threadId de la URL. Un BehaviorSubject para poder cambiarlo en vivo. */
  let params: BehaviorSubject<Map<string, string>>;
  let authStub: { logout: ReturnType<typeof vi.fn> };
  let filtersStub: { currentFilters: ReturnType<typeof signal> };

  async function build(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        // La ruta de login tiene que existir: el componente navega ahi cuando
        // el token vence, y con un router vacio esa navegacion rechaza fuera
        // de la promesa del test (unhandled rejection, no fallo visible).
        provideRouter([{ path: 'auth/login', children: [] }]),
        { provide: ChatService, useValue: chatStub },
        { provide: FiltersService, useValue: filtersStub },
        { provide: AuthService, useValue: authStub },
        { provide: ChatSessionsStore, useValue: sessionsStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: params.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    params = new BehaviorSubject(new Map<string, string>());
    sessionsStub = { refresh: vi.fn() };
    chatStub = {
      currentThreadId: vi.fn().mockReturnValue('thread-1'),
      startNewThread: vi.fn().mockReturnValue('thread-2'),
      rememberThread: vi.fn(),
      loadHistory: vi.fn().mockReturnValue(of({ messages: [], running: false })),
      sendTurn: turnThatStreams(['Pensando…'], ['Hola', ' de nuevo']),
    };
    authStub = { logout: vi.fn() };
    filtersStub = { currentFilters: signal(null) };
    await build();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  describe('on init', () => {
    it('greets when there is no history', () => {
      expect(component.messages().length).toBe(1);
      expect(component.messages()[0].role).toBe('ai');
      expect(component.messages()[0].text).toContain('orientador vocacional');
    });

    it('promises only what the agent can actually deliver', () => {
      // Decía «datos oficiales de Ponte en Carrera para darte recomendaciones
      // basadas en el mercado laboral real peruano» cuando el agente no tenía
      // ni un dato del MINEDU. Ahora sí los tiene, pero el 73% de los sueldos
      // del dataset son la mediana de la familia de carrera, así que la
      // bienvenida no los usa de gancho: eso lo matiza el agente dato a dato.
      const welcome = component.messages()[0].text;

      expect(welcome).toContain('Ponte en Carrera');
      expect(welcome).not.toMatch(/sueldo|salario|mercado laboral/i);
    });

    it('repopulates a previous conversation instead of greeting', async () => {
      const history: ChatMessage[] = [
        { id: 'h1', role: 'user', text: 'hola', timestamp: '2026-08-05T12:00:00.000Z' },
        { id: 'h2', role: 'ai', text: 'qué tal', timestamp: '2026-08-05T12:00:01.000Z' },
      ];
      chatStub.loadHistory = vi.fn().mockReturnValue(of({ messages: history, running: false }));
      TestBed.resetTestingModule();
      await build();

      expect(component.messages().map((m) => m.text)).toEqual(['hola', 'qué tal']);
    });

    it('still opens the chat when the history fails to load', async () => {
      chatStub.loadHistory = vi.fn().mockReturnValue(throwError(() => new Error('down')));
      TestBed.resetTestingModule();
      await build();

      expect(component.loadingSession()).toBe(false);
      expect(component.messages().length).toBe(1);
    });
  });

  describe('sending a turn', () => {
    it('does nothing on an empty draft', async () => {
      component.draft = '   ';

      component.send();

      expect(chatStub.sendTurn).not.toHaveBeenCalled();
    });

    it('appends the student message and clears the input immediately', async () => {
      component.draft = 'me gustan las matemáticas';

      component.send();

      // El mensaje del estudiante aparece antes de que el agente conteste,
      // no cuando la respuesta termina. Se busca por rol en vez de mirar el
      // ultimo porque el stub responde sin ceder el control al event loop.
      const userMessages = component.messages().filter((m) => m.role === 'user');
      expect(component.draft).toBe('');
      expect(userMessages.map((m) => m.text)).toEqual(['me gustan las matemáticas']);
    });

    it('builds the answer delta by delta into a single bubble', async () => {
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      const last = component.messages().at(-1);
      expect(last?.role).toBe('ai');
      expect(last?.text).toBe('Hola de nuevo');
      expect(last?.streaming).toBe(false);
    });

    it('shows the current step while the agent works, then clears it', async () => {
      const seen: (string | null)[] = [];
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onStep('Recordando lo que ya sé de ti…');
        seen.push(component.currentStep());
        handlers.onAnswerStart('m-1');
        seen.push(component.currentStep());
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      // Un paso visible mientras piensa; y en cuanto empieza a escribir, el
      // indicador desaparece porque el texto ya es señal suficiente.
      expect(seen).toEqual(['Recordando lo que ya sé de ti…', null]);
      expect(component.currentStep()).toBeNull();
    });

    it('ignores a second send while a turn is in flight', async () => {
      component.draft = 'uno';
      component.send();
      component.draft = 'dos';

      component.send();

      expect(chatStub.sendTurn).toHaveBeenCalledOnce();
    });
  });

  describe('showing what the agent is doing', () => {
    it('lists the tools live and keeps them on the answer afterwards', async () => {
      // Saber que la respuesta salio de una busqueda en internet importa
      // despues de leerla, no solo mientras se genera.
      const seenDuringTurn: string[][] = [];
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        seenDuringTurn.push(component.activities().map((a) => a.label));
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(seenDuringTurn[0]).toEqual(['Buscando en internet…']);
      expect(
        component
          .messages()
          .at(-1)
          ?.activities?.map((a) => a.label),
      ).toEqual(['Buscando en internet…']);
      // La lista en vivo se limpia: si no, saldria duplicada junto a la que
      // ya quedo pegada al mensaje.
      expect(component.activities()).toEqual([]);
    });

    it('replaces the generic step as soon as it can say something concrete', async () => {
      const stepWhenToolStarted: (string | null)[] = [];
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onStep('Pensando…');
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        stepWhenToolStarted.push(component.currentStep());
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(stepWhenToolStarted).toEqual([null]);
    });

    it('renders the activity list in the bubble, not just in memory', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();
      fixture.detectChanges();

      const rendered = fixture.nativeElement.querySelectorAll('.chat__activities--done li');
      expect(rendered.length).toBe(1);
      expect(rendered[0].textContent).toContain('Buscando en internet');
    });

    it('shows what it searched for and why, not just that it searched', async () => {
      // Lo que el estudiante veia era «Buscando una herramienta…» y nada mas:
      // ni con que la llamo ni para que sirve.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart(
          'tc-1',
          'Buscando carreras en universidades e institutos…',
          'para recomendarte carreras que existen de verdad',
          'tool',
        );
        handlers.onToolDetail('tc-1', '«ingeniería» · en Áncash');
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();
      fixture.detectChanges();

      const chip = fixture.nativeElement.querySelector('.chat__activities--done li');
      expect(chip.textContent).toContain('Buscando carreras en universidades e institutos');
      expect(chip.textContent).toContain('«ingeniería» · en Áncash');
      expect(chip.textContent).toContain('para recomendarte carreras que existen de verdad');
    });

    it('fills the chip that is already on screen instead of adding another', async () => {
      // El detalle llega despues del START: los argumentos los dicta el
      // modelo token a token. Si abriera un chip nuevo, cada busqueda se
      // veria dos veces.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        handlers.onToolDetail('tc-1', '«becas Pronabec»');
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      const chips = component.messages().at(-1)?.activities ?? [];
      expect(chips.length).toBe(1);
      expect(chips[0].detail).toBe('«becas Pronabec»');
      expect(chips[0].label).toBe('Buscando en internet…');
    });

    it('does not attach an activity list to an answer that used no tools', async () => {
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.activities).toBeUndefined();
    });

    /*
     * LA QUEJA: los chips se pintaban ABAJO, por debajo del texto ya escrito,
     * y la respuesta se leia partida en dos.
     *
     * Pasaba porque `attachActivities` solo corria al TERMINAR el turno.
     * Durante toda la generacion --que es justo cuando el estudiante los mira--
     * los chips vivian en una burbuja suelta al final de la lista.
     *
     * Ahora se pegan a la primera burbuja del turno en cuanto existe. La
     * plantilla ya los pintaba encima del texto dentro de la burbuja, asi que
     * con esto el orden queda: primero que hice, luego que te digo.
     */
    it('pega los chips a la respuesta MIENTRAS el turno corre, no al final', async () => {
      let continuar!: () => void;
      const enEspera = new Promise<void>((r) => (continuar = r));

      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'primera parte');
        handlers.onToolStart('tc-1', 'Organizando el plan…', '', 'tool');
        await enEspera;
      });
      component.draft = 'hola';

      component.send();
      await Promise.resolve();
      await Promise.resolve();

      // Sin esperar a que el turno acabe: el chip ya esta DENTRO de la burbuja.
      const burbuja = component.messages().find((m) => m.id === 'm-1');
      expect(burbuja?.activities?.length).toBe(1);
      expect(burbuja?.activities?.[0].label).toBe('Organizando el plan…');
      // Y sigue marcado como en curso, que es lo que hace llevadera la espera.
      expect(burbuja?.activities?.[0].running).toBe(true);

      continuar();
      await fixture.whenStable();
    });

    it('no deja la burbuja suelta de chips cuando ya hay respuesta', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'texto');
        handlers.onToolStart('tc-1', 'Organizando el plan…', '', 'tool');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      // `turnoActual` es lo que la plantilla mira para decidir si pinta la
      // burbuja suelta. Con portador, no la pinta.
      expect(component.turnoActual()).toBe('m-1');
    });

    it('los chips que llegan antes del texto siguen teniendo donde vivir', async () => {
      // El agente usa herramientas antes de escribir nada. Ahi no hay burbuja
      // a la que pegarlos, y la suelta es la que los ensena -- sin texto
      // debajo, «al final» y «encima de la respuesta» son el mismo sitio.
      let continuar!: () => void;
      const enEspera = new Promise<void>((r) => (continuar = r));

      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart('tc-1', 'Buscando en internet…', '', 'search');
        await enEspera;
      });
      component.draft = 'hola';

      component.send();
      await Promise.resolve();
      await Promise.resolve();

      // El turno sigue abierto a proposito: al cerrarlo, el `finally` vacia la
      // lista en vivo y esta comprobacion dejaria de significar nada.
      expect(component.turnoActual()).toBeNull();
      expect(component.activities().length).toBe(1);

      continuar();
      await fixture.whenStable();
    });

    it('un turno nuevo no cuelga sus chips de la respuesta del anterior', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'primera');
      });
      component.draft = 'hola';
      component.send();
      await fixture.whenStable();

      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart('tc-2', 'Buscando en internet…', '', 'search');
        handlers.onAnswerStart('m-2');
        handlers.onDelta('m-2', 'segunda');
      });
      component.draft = 'otra';
      component.send();
      await fixture.whenStable();

      const primera = component.messages().find((m) => m.id === 'm-1');
      const segunda = component.messages().find((m) => m.id === 'm-2');
      expect(primera?.activities ?? []).toEqual([]);
      expect(segunda?.activities?.length).toBe(1);
    });

    it('upgrades the generic task chip to the specialist it delegated to', async () => {
      // El evento de subagente llega con el MISMO toolCallId que la tool
      // `task` que lo envuelve. Si se tratara como un chip nuevo, el
      // estudiante veria dos veces la misma delegacion.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart('tc-1', 'Consultando a un especialista…', '', 'tool');
        handlers.onSubagentStart(
          'tc-1',
          'Evaluando tu perfil vocacional…',
          'un especialista arma tu perfil',
        );
        handlers.onSubagentEnd('tc-1', true, 8400);
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      const chips = component.messages().at(-1)?.activities ?? [];
      expect(chips.length).toBe(1);
      expect(chips[0].label).toBe('Evaluando tu perfil vocacional…');
      expect(chips[0].kind).toBe('subagent');
      // Que 8400 ms se lean como « · 8.4 s» lo cubre activity-timing.spec.ts;
      // aquí lo que importa es que la duración llegó al chip.
      expect(chips[0].durationMs).toBe(8400);
    });

    it('marks the chip as failed when a delegation could not be completed', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onSubagentStart(
          'tc-1',
          'Armando tu plan de acción…',
          'un especialista arma los pasos',
        );
        handlers.onSubagentEnd('tc-1', false, 1200);
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      const chip = (component.messages().at(-1)?.activities ?? [])[0];
      expect(chip.ok).toBe(false);
      // El texto « · no pudo completarse» es de activity-timing.spec.ts. Aquí:
      // que el fallo del especialista quedó marcado en el chip, con su duración.
      expect(chip.durationMs).toBe(1200);
    });

    it('deja el enlace al informe en la burbuja del turno', async () => {
      // El informe no viaja por el chat --son decenas de miles de
      // caracteres-- asi que sin esto lo unico que quedaba en pantalla era el
      // agente diciendo que estaba listo, y habia que buscarlo por el menu.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'tu informe esta listo');
        handlers.onReportReady('rep-42');
      });
      component.draft = 'genérame mi reporte';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.reportId).toBe('rep-42');
    });

    it('un turno sin informe no deja enlace', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'te cuento');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.reportId).toBeUndefined();
    });

    it('keeps the chips when the turn produces several bubbles', async () => {
      // Antes se pegaban a la ULTIMA burbuja. Ahora van a la primera: las
      // herramientas corren antes del texto que producen, y la ultima
      // respuesta suele ser un cierre corto al que no pertenecen.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'déjame consultarlo');
        handlers.onAnswerEnd('m-1');
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart('m-2');
        handlers.onDelta('m-2', 'esto encontré');
        handlers.onAnswerEnd('m-2');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      const bubbles = component.messages().filter((m) => m.role === 'ai' && m.text);
      expect(bubbles.map((m) => m.text)).toEqual([
        expect.stringContaining('orientador vocacional'),
        'déjame consultarlo',
        'esto encontré',
      ]);
      expect(bubbles.at(-2)?.activities?.length).toBe(1);
    });

    it('never leaves an earlier bubble stuck as if it were still being written', async () => {
      // Con un solo id por turno, la primera burbuja se quedaba con
      // streaming:true para siempre: el cursor parpadeando bajo un texto
      // que ya estaba completo.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'primera');
        handlers.onAnswerStart('m-2');
        handlers.onDelta('m-2', 'segunda');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().some((m) => m.streaming)).toBe(false);
    });

    it('collapses six repeated calls to the same tool into one chip', async () => {
      // El caso real (dev, 2026-08-09): el coordinador reformuló la misma
      // búsqueda seis veces contra la misma herramienta. Sin agrupar, eso
      // pintaba seis <li> casi idénticos que empujaban la respuesta fuera
      // de la pantalla.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        ['*', 'ingeniería', 'salud medicina', 'educación', 'derecho', 'artes'].forEach((q, i) => {
          handlers.onToolStart(
            `tc-${i}`,
            'Consultando el catálogo de carreras…',
            'para describirte la carrera con el catálogo delante',
            'tool',
          );
          handlers.onToolDetail(`tc-${i}`, `«${q}»`);
          handlers.onToolEnd(`tc-${i}`);
        });
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'listo');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();
      fixture.detectChanges();

      // `> li` y no `li`: el desplegable con el detalle de cada llamada
      // también son <li>, y sin el hijo directo el conteo los mezclaría.
      const rendered = fixture.nativeElement.querySelectorAll('.chat__activities--done > li');
      expect(rendered.length).toBe(1);
      expect(rendered[0].textContent).toContain('6 veces');
      expect(rendered[0].querySelectorAll('.chat__activity-calls li').length).toBe(6);
    });

    it('opens a bubble for a delta whose start never arrived', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onDelta('m-huerfano', 'texto sin START');
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.text).toBe('texto sin START');
    });
  });

  describe('a turn that answers without streaming any text', () => {
    // Un guardrail, el filtro de contenido o el tope de turnos cortan el
    // turno inyectando el mensaje directo en el estado del grafo: no hay
    // ningun TEXT_MESSAGE_*. Sin leer el snapshot, el estudiante se queda
    // mirando su pregunta sin ninguna respuesta en pantalla.
    it('recovers the answer from the messages snapshot', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onSnapshot([
          { id: 'h1', role: 'user', content: 'hola' },
          { id: 'bloqueo', role: 'assistant', content: 'No puedo ayudarte con eso.' },
        ]);
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.text).toBe('No puedo ayudarte con eso.');
      expect(component.messages().at(-1)?.role).toBe('ai');
    });

    it('keeps the chips of what it did before being cut off', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onToolStart(
          'tc-1',
          'Buscando en internet…',
          'porque eso cambia con el tiempo',
          'search',
        );
        handlers.onToolEnd('tc-1');
        handlers.onSnapshot([{ id: 'x', role: 'assistant', content: 'No puedo ayudarte.' }]);
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.activities?.length).toBe(1);
    });

    it('does not duplicate a message that is already on screen', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        handlers.onDelta('m-1', 'respuesta');
        handlers.onSnapshot([{ id: 'm-1', role: 'assistant', content: 'respuesta' }]);
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().filter((m) => m.text === 'respuesta').length).toBe(1);
    });

    it('does not resurrect a stale answer when the turn failed', async () => {
      // El snapshot puede haberse emitido antes del fallo. Pintar ese
      // mensaje seria enseñar como respuesta algo que no lo es.
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onSnapshot([{ id: 'viejo', role: 'assistant', content: 'de otro turno' }]);
        throw new AgentStreamError('agent', 'boom', 500);
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().some((m) => m.text === 'de otro turno')).toBe(false);
      expect(component.errorMessage()).toBeTruthy();
    });
  });

  describe('when the agent fails', () => {
    async function failWith(error: unknown): Promise<void> {
      chatStub.sendTurn = vi.fn().mockRejectedValue(error);
      component.draft = 'hola';
      component.send();
      await fixture.whenStable();
    }

    it('explains a rate limit in words a student understands', async () => {
      await failWith(new AgentStreamError('rate-limited', 'Rate limit exceeded', 429));

      expect(component.errorMessage()).toContain('Espera unos segundos');
    });

    it('distinguishes the daily budget from the burst limit', async () => {
      await failWith(new AgentStreamError('budget-exhausted', 'Daily request budget', 429));

      expect(component.errorMessage()).toContain('mañana');
    });

    it('logs out on an expired token, which no interceptor covers here', async () => {
      // authInterceptor y errorInterceptor solo ven peticiones de HttpClient;
      // el stream va por fetch, asi que sin esto el estudiante se queda
      // escribiendo en un chat que nunca responde.
      await failWith(new AgentStreamError('unauthorized', 'no token', 401));

      expect(authStub.logout).toHaveBeenCalledOnce();
    });

    it('does not leave an empty bubble behind', async () => {
      chatStub.sendTurn = vi.fn(async (_t: string, _x: string, handlers: ChatTurnHandlers) => {
        handlers.onAnswerStart('m-1');
        throw new AgentStreamError('agent', 'boom', 500);
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().some((m) => m.role === 'ai' && m.text === '')).toBe(false);
    });

    it('re-enables the composer so the student can retry', async () => {
      await failWith(new AgentStreamError('network', 'offline'));

      expect(component.sending()).toBe(false);
    });
  });

  /**
   * Un turno que sigue vivo en el agente y que esta pestaña no lanzó.
   *
   * Desde `spark-match-07-deep-agent#89` cerrar la pestaña ya no mata el
   * turno, así que volver a entrar puede pillarlo a medias. Sin esperarlo, la
   * pantalla enseñaría la pregunta sin nada debajo y el estudiante la
   * repetiría — llevándose un 409.
   */
  describe('waiting for a turn that is already running', () => {
    /** `running: true` las primeras `hasta` veces, y luego la respuesta. */
    function historialQueTardaEnResponder(hasta: number) {
      let llamadas = 0;
      const pregunta: ChatMessage = {
        id: 'q1',
        role: 'user',
        text: '¿cuánto cuesta medicina?',
        timestamp: '2026-08-10T12:00:00.000Z',
      };
      const respuesta: ChatMessage = {
        id: 'a1',
        role: 'ai',
        text: 'Depende de la universidad.',
        timestamp: '2026-08-10T12:00:30.000Z',
      };

      return vi.fn(() => {
        llamadas += 1;
        return llamadas < hasta
          ? of({ messages: [pregunta], running: true })
          : of({ messages: [pregunta, respuesta], running: false });
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('says the answer is on its way instead of showing nothing', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(99);
      TestBed.resetTestingModule();
      await build();

      expect(component.turnoEnCurso()).toBe(true);
    });

    it('does not let a second message go out while it waits', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(99);
      TestBed.resetTestingModule();
      await build();

      component.draft = 'otra pregunta';
      component.send();

      expect(chatStub.sendTurn).not.toHaveBeenCalled();
    });

    it('brings the answer in when the agent finishes', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(3);
      TestBed.resetTestingModule();
      await build();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(component.turnoEnCurso()).toBe(false);
      expect(component.messages().map((m) => m.text)).toEqual([
        '¿cuánto cuesta medicina?',
        'Depende de la universidad.',
      ]);
    });

    it('keeps asking until it gets an answer, and then stops', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(3);
      TestBed.resetTestingModule();
      await build();

      await vi.advanceTimersByTimeAsync(10_000);
      const alTerminar = chatStub.loadHistory.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);

      expect(chatStub.loadHistory.mock.calls.length).toBe(alTerminar);
    });

    it('gives up eventually instead of waiting for something that is not coming', async () => {
      // Un arrendamiento puede quedar colgado si el proceso del agente muere
      // a mitad. Sondear para siempre dejaria la pantalla bloqueada.
      chatStub.loadHistory = historialQueTardaEnResponder(Number.MAX_SAFE_INTEGER);
      TestBed.resetTestingModule();
      await build();

      await vi.advanceTimersByTimeAsync(6 * 60_000);

      expect(component.turnoEnCurso()).toBe(false);
      expect(component.errorMessage()).toContain('Recarga la página');
    });

    it('a failed poll does not leave the screen stuck on «answering»', async () => {
      let primera = true;
      chatStub.loadHistory = vi.fn(() => {
        if (primera) {
          primera = false;
          return of({ messages: [], running: true });
        }
        return throwError(() => new Error('se cayo'));
      });
      TestBed.resetTestingModule();
      await build();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(component.turnoEnCurso()).toBe(false);
    });

    it('stops when the student opens another conversation', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(99);
      TestBed.resetTestingModule();
      await build();

      params.next(new Map([['threadId', 'otro-hilo']]));
      const alCambiar = chatStub.loadHistory.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);

      // La conversacion nueva tambien dice `running`, asi que sondea ella;
      // lo que no puede pasar es que sigan sondeando las dos.
      const sondeos = chatStub.loadHistory.mock.calls.length - alCambiar;
      expect(sondeos).toBeLessThanOrEqual(Math.ceil(30_000 / 3000));
    });

    it('stops when the component goes away', async () => {
      chatStub.loadHistory = historialQueTardaEnResponder(99);
      TestBed.resetTestingModule();
      await build();

      fixture.destroy();
      const alDestruir = chatStub.loadHistory.mock.calls.length;
      await vi.advanceTimersByTimeAsync(30_000);

      expect(chatStub.loadHistory.mock.calls.length).toBe(alDestruir);
    });

    it('waits for the answer after a 409 instead of just apologising', async () => {
      // El 409 dice que hay una respuesta en camino en esta conversacion.
      // Dejar solo el aviso seria pedirle al estudiante que reintente a
      // ciegas justo cuando lo unico util es esperar.
      chatStub.sendTurn = vi.fn().mockRejectedValue(new AgentStreamError('busy', 'ocupado', 409));
      TestBed.resetTestingModule();
      await build();
      chatStub.loadHistory = historialQueTardaEnResponder(99);

      component.draft = 'hola';
      component.send();
      await vi.advanceTimersByTimeAsync(0);

      expect(component.turnoEnCurso()).toBe(true);
    });
  });

  describe('switching conversations', () => {
    it('uses the id from the URL when there is one', async () => {
      params.next(new Map([['threadId', 'de-la-url']]));
      TestBed.resetTestingModule();
      await build();

      expect(chatStub.loadHistory).toHaveBeenCalledWith('de-la-url');
    });

    it('falls back to the last conversation when the URL has no id', () => {
      expect(chatStub.loadHistory).toHaveBeenCalledWith('thread-1');
    });

    it('reloads when the URL changes without remounting the component', () => {
      // La misma instancia sirve /assessment y /assessment/:threadId, asi que
      // cambiar de conversacion desde el sidebar NO vuelve a llamar ngOnInit.
      // Leyendo el snapshot una sola vez, el chat se quedaria en el hilo viejo.
      chatStub.loadHistory.mockReturnValue(
        of({
          messages: [
            {
              id: 'x',
              role: 'ai' as const,
              text: 'otra conversación',
              timestamp: '2026-08-05T12:00:00.000Z',
            },
          ],
          running: false,
        }),
      );

      params.next(new Map([['threadId', 'otro-hilo']]));

      expect(chatStub.loadHistory).toHaveBeenCalledWith('otro-hilo');
      expect(component.messages().map((m) => m.text)).toEqual(['otra conversación']);
    });

    it('remembers the opened conversation so returning without an id lands here', () => {
      params.next(new Map([['threadId', 'de-la-url']]));

      expect(chatStub.rememberThread).toHaveBeenCalledWith('de-la-url');
    });

    it('refreshes the sidebar after a turn, not before', async () => {
      // El indice del agente se escribe al procesar el turno: pedir la lista
      // antes devolveria una conversacion nueva que todavia no existe.
      expect(sessionsStub.refresh).not.toHaveBeenCalled();

      component.draft = 'hola';
      component.send();
      await fixture.whenStable();

      expect(sessionsStub.refresh).toHaveBeenCalledOnce();
    });
  });

  describe('profile summary', () => {
    it('reports "Sin filtros configurados" when no filters are set', () => {
      expect(component.profileSummary).toBe('Sin filtros configurados');
    });

    it('formats region and capitalized institution', () => {
      filtersStub.currentFilters.set({ region: 'Lima', institutionType: 'privada' } as never);

      expect(component.profileSummary).toBe('Lima · Privada');
    });

    it('uses "Pública/Privada" when institutionType is "ambas"', () => {
      filtersStub.currentFilters.set({ region: 'Cusco', institutionType: 'ambas' } as never);

      expect(component.profileSummary).toBe('Cusco · Pública/Privada');
    });
  });

  it('formats timestamps in es-PE locale', () => {
    expect(component.timeLabel('2026-07-26T17:05:00.000Z')).toMatch(/\d{2}:\d{2}/);
  });
});
