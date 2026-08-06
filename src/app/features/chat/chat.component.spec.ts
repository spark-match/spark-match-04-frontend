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
    handlers.onAnswerStart();
    for (const chunk of chunks) handlers.onDelta(chunk);
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
      loadHistory: vi.fn().mockReturnValue(of([])),
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

    it('repopulates a previous conversation instead of greeting', async () => {
      const history: ChatMessage[] = [
        { id: 'h1', role: 'user', text: 'hola', timestamp: '2026-08-05T12:00:00.000Z' },
        { id: 'h2', role: 'ai', text: 'qué tal', timestamp: '2026-08-05T12:00:01.000Z' },
      ];
      chatStub.loadHistory = vi.fn().mockReturnValue(of(history));
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
        handlers.onAnswerStart();
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
        handlers.onToolStart('tc-1', 'Buscando en internet…');
        seenDuringTurn.push(component.activities().map((a) => a.label));
        handlers.onToolEnd('tc-1');
        handlers.onAnswerStart();
        handlers.onDelta('listo');
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
        handlers.onToolStart('tc-1', 'Buscando en internet…');
        stepWhenToolStarted.push(component.currentStep());
      });
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(stepWhenToolStarted).toEqual([null]);
    });

    it('does not attach an activity list to an answer that used no tools', async () => {
      component.draft = 'hola';

      component.send();
      await fixture.whenStable();

      expect(component.messages().at(-1)?.activities).toBeUndefined();
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
        handlers.onAnswerStart();
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
        of([
          {
            id: 'x',
            role: 'ai' as const,
            text: 'otra conversación',
            timestamp: '2026-08-05T12:00:00.000Z',
          },
        ]),
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
