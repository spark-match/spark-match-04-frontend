import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { ChatActivity, ChatMessage } from './chat.model';
import { AgUiSnapshotMessage } from '../../core/agent/ag-ui.model';
import { AgentStreamError, agentErrorMessage } from '../../core/agent/ag-ui.client';
import { INITIAL_STEP_LABEL } from '../../core/agent/step-labels';
import { AuthService } from '../../core/auth/auth.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ChatSessionsStore } from './chat-sessions.store';
import { Subscription } from 'rxjs';

const WELCOME_TEXT =
  '¡Hola! Soy tu orientador vocacional con IA. Usamos datos oficiales de Ponte en Carrera ' +
  'del Ministerio de Educación para darte recomendaciones basadas en el mercado laboral ' +
  'real peruano. ¿Por dónde empezamos?';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterLink, MarkdownPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly filtersService = inject(FiltersService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sessions = inject(ChatSessionsStore);

  private threadId = '';
  private abort: AbortController | null = null;
  private routeSub: Subscription | null = null;

  draft = '';
  readonly sending = signal(false);
  readonly loadingSession = signal(true);
  readonly messages = signal<ChatMessage[]>([]);
  /** Lo que el agente está haciendo ahora mismo; null cuando ya escribe. */
  readonly currentStep = signal<string | null>(null);
  /** Herramientas del turno en curso: búsquedas web, catálogo, subagentes. */
  readonly activities = signal<ChatActivity[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly showRecommendationRating = signal(false);
  readonly rating = signal(0);
  readonly submittingRating = signal(false);
  readonly ratingSubmitted = signal(false);

  get profileSummary(): string {
    const filters = this.filtersService.currentFilters();
    if (!filters) return 'Sin filtros configurados';
    const institution =
      filters.institutionType === 'ambas' ? 'Pública/Privada' : capitalize(filters.institutionType);
    return `${filters.region} · ${institution}`;
  }

  ngOnInit(): void {
    // Por paramMap y no leyendo el snapshot una vez: la misma instancia del
    // componente sirve `/assessment` y `/assessment/:threadId`, asi que
    // cambiar de conversación desde el sidebar NO vuelve a llamar a ngOnInit.
    // Con el snapshot, el chat se quedaría mostrando el hilo anterior.
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.openThread(params.get('threadId') ?? this.chatService.currentThreadId());
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    // Sin esto, salir de la pantalla a mitad de respuesta deja al agente
    // generando contra un lector que ya no existe.
    this.abort?.abort();
  }

  private openThread(threadId: string): void {
    // Cambiar de conversación cancela lo que quedara corriendo de la
    // anterior; si no, sus tokens seguirían llegando a la pantalla nueva.
    this.abort?.abort();
    this.abort = null;
    this.sending.set(false);
    this.currentStep.set(null);
    this.errorMessage.set(null);

    this.threadId = threadId;
    this.chatService.rememberThread(threadId);
    this.loadingSession.set(true);
    this.messages.set([]);

    this.chatService.loadHistory(threadId).subscribe({
      next: (history) => {
        this.messages.set(history.length ? history : [welcomeMessage()]);
        this.loadingSession.set(false);
      },
      // Que falle el historial no debe dejar al estudiante sin chat: se
      // arranca la conversación igual, solo que sin lo anterior.
      error: () => {
        this.messages.set([welcomeMessage()]);
        this.loadingSession.set(false);
      },
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text || this.sending()) return;

    this.errorMessage.set(null);
    this.appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    });
    this.draft = '';
    this.sending.set(true);
    this.currentStep.set(INITIAL_STEP_LABEL);
    this.activities.set([]);

    void this.runTurn(text);
  }

  private async runTurn(text: string): Promise<void> {
    this.abort = new AbortController();
    // Un turno puede producir varias burbujas: el coordinador escribe,
    // delega en un especialista, y vuelve a escribir. Antes se guardaba un
    // solo id y las anteriores quedaban en «escribiendo» para siempre.
    const answerIds: string[] = [];
    let snapshot: AgUiSnapshotMessage[] = [];
    let failed = false;

    try {
      await this.chatService.sendTurn(
        this.threadId,
        text,
        {
          onStep: (label) => this.currentStep.set(label),
          onAnswerStart: (messageId) => {
            // La respuesta empieza: el indicador de progreso ya no aporta,
            // el texto que aparece es señal suficiente.
            this.currentStep.set(null);
            answerIds.push(messageId);
            this.openBubble(messageId);
          },
          onDelta: (messageId, delta) => {
            // Abre la burbuja si el START no llegó: un token perdido es una
            // frase cortada en mitad de la pantalla del estudiante.
            if (!answerIds.includes(messageId)) {
              answerIds.push(messageId);
              this.openBubble(messageId);
            }
            this.appendDelta(messageId, delta);
          },
          onAnswerEnd: (messageId) => this.finishStreaming(messageId),
          onToolStart: (toolCallId, label) => {
            // El paso genérico deja de aportar en cuanto se puede decir algo
            // concreto ("Buscando en internet…" en vez de "Pensando…").
            this.currentStep.set(null);
            this.upsertActivity({ id: toolCallId, label, running: true, kind: 'tool' });
          },
          onToolEnd: (toolCallId) => this.patchActivity(toolCallId, { running: false }),
          onSubagentStart: (toolCallId, label) => {
            this.currentStep.set(null);
            // Mismo `toolCallId` que la tool `task` que lo envuelve, así que
            // esto asciende el chip genérico en vez de duplicarlo.
            this.upsertActivity({ id: toolCallId, label, running: true, kind: 'subagent' });
          },
          onSubagentEnd: (toolCallId, ok, durationMs) =>
            this.patchActivity(toolCallId, { running: false, kind: 'subagent', ok, durationMs }),
          onSnapshot: (messages) => {
            snapshot = messages;
          },
        },
        this.abort.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      failed = true;
      this.handleTurnError(error, answerIds);
      return;
    } finally {
      this.abort = null;
      this.sending.set(false);
      this.currentStep.set(null);
      answerIds.forEach((id) => this.finishStreaming(id));

      // Un turno cortado por un guardrail, por el filtro de contenido o por
      // el tope de turnos no genera NINGÚN TEXT_MESSAGE_*: el agente inyecta
      // la respuesta directo en el estado del grafo. Sin rescatarla del
      // snapshot, el estudiante se queda mirando su pregunta sin respuesta.
      const recovered = failed || answerIds.length ? null : this.recoverAnswer(snapshot);
      const carrier = answerIds[0] ?? recovered;
      if (carrier) this.attachActivities(carrier);

      this.activities.set([]);
      // El indice del agente se escribe al procesar el turno, asi que la
      // lista del sidebar solo es correcta despues de esto: una conversacion
      // nueva no existe hasta su primer mensaje, y una vieja cambia de
      // posicion al retomarla.
      this.sessions.refresh();
    }
  }

  private handleTurnError(error: unknown, answerIds: string[]): void {
    // Una burbuja vacía a medio escribir es peor que ninguna.
    answerIds.forEach((id) => this.dropIfEmpty(id));
    this.errorMessage.set(agentErrorMessage(error));

    // El interceptor que cierra sesión en 401 solo cubre HttpClient, y esto
    // va por fetch: sin esto, un token vencido deja al estudiante escribiendo
    // en un chat que nunca responde.
    if (error instanceof AgentStreamError && error.kind === 'unauthorized') {
      this.auth.logout();
      void this.router.navigate(['/auth/login']);
    }
  }

  private appendMessage(message: ChatMessage): void {
    this.messages.update((msgs) => [...msgs, message]);
  }

  /** Abre una burbuja vacía para el mensaje que el agente empieza a escribir. */
  private openBubble(id: string): void {
    if (this.messages().some((msg) => msg.id === id)) return;
    this.appendMessage({
      id,
      role: 'ai',
      text: '',
      timestamp: new Date().toISOString(),
      streaming: true,
    });
  }

  private appendDelta(id: string, delta: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => (msg.id === id ? { ...msg, text: msg.text + delta } : msg)),
    );
  }

  private upsertActivity(activity: ChatActivity): void {
    this.activities.update((list) =>
      list.some((a) => a.id === activity.id)
        ? list.map((a) => (a.id === activity.id ? { ...a, ...activity } : a))
        : [...list, activity],
    );
  }

  private patchActivity(id: string, patch: Partial<ChatActivity>): void {
    this.activities.update((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  /**
   * Rescata del snapshot la respuesta de un turno que no emitió texto.
   *
   * Devuelve el id de la burbuja creada, o `null` si no había nada que
   * rescatar. Se coge sólo el último mensaje del asistente que no estuviera
   * ya en pantalla: es el del turno que acaba de terminar, y los anteriores
   * o ya están o pertenecen a otro turno.
   */
  private recoverAnswer(snapshot: AgUiSnapshotMessage[]): string | null {
    const known = new Set(this.messages().map((msg) => msg.id));
    const pending = snapshot.filter(
      (msg) => msg.role === 'assistant' && msg.content.trim() && msg.id && !known.has(msg.id),
    );
    const answer = pending.at(-1);
    if (!answer) return null;

    this.appendMessage({
      id: answer.id,
      role: 'ai',
      text: answer.content,
      timestamp: new Date().toISOString(),
    });
    return answer.id;
  }

  /**
   * Pega al mensaje las herramientas que se usaron para producirlo.
   *
   * Se hace al cerrar el turno y no mientras corre, porque durante el turno
   * la lista se pinta aparte (encima del texto que se está escribiendo) y
   * duplicarla en los dos sitios se vería dos veces.
   *
   * Va a la PRIMERA burbuja del turno, no a la última: las herramientas
   * corren antes del texto que producen, y cuando hay varias respuestas la
   * última suele ser un cierre corto al que esos chips no pertenecen.
   */
  private attachActivities(id: string): void {
    const used = this.activities().map((a) => ({ ...a, running: false }));
    if (!used.length) return;
    this.messages.update((msgs) =>
      msgs.map((msg) => (msg.id === id ? { ...msg, activities: used } : msg)),
    );
  }

  private finishStreaming(id: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => (msg.id === id ? { ...msg, streaming: false } : msg)),
    );
  }

  private dropIfEmpty(id: string): void {
    this.messages.update((msgs) => msgs.filter((msg) => msg.id !== id || msg.text.length > 0));
  }

  rateRecommendation(rating: number): void {
    if (this.submittingRating() || this.ratingSubmitted()) return;
    // El endpoint de feedback todavía no existe en ningún lado (ver README);
    // se registra localmente para no perder el gesto del estudiante.
    this.rating.set(rating);
    this.ratingSubmitted.set(true);
  }

  dismissRecommendationRating(): void {
    this.showRecommendationRating.set(false);
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }

  timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * El sufijo del chip: cuánto tardó el especialista, o que no pudo.
   *
   * Vacío mientras corre — un contador subiendo distrae del texto que se
   * está escribiendo — y vacío también para las herramientas normales, que
   * no reportan duración.
   */
  activityDetail(activity: ChatActivity): string {
    if (activity.running) return '';
    if (activity.ok === false) return ' · no pudo completarse';
    if (activity.durationMs === undefined) return '';
    // Los milisegundos por debajo del segundo se dejan tal cual en vez de
    // redondear a «1 s»: redondear hacia arriba exagera lo que costó.
    return activity.durationMs < 1000
      ? ` · ${activity.durationMs} ms`
      : ` · ${(activity.durationMs / 1000).toFixed(1)} s`;
  }
}

function welcomeMessage(): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'ai',
    text: WELCOME_TEXT,
    timestamp: new Date().toISOString(),
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
