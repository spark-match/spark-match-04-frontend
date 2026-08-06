import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { ChatMessage } from './chat.model';
import { AgentStreamError, agentErrorMessage } from '../../core/agent/ag-ui.client';
import { INITIAL_STEP_LABEL } from '../../core/agent/step-labels';
import { AuthService } from '../../core/auth/auth.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';

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

  private threadId = '';
  private abort: AbortController | null = null;

  draft = '';
  readonly sending = signal(false);
  readonly loadingSession = signal(true);
  readonly messages = signal<ChatMessage[]>([]);
  /** Lo que el agente está haciendo ahora mismo; null cuando ya escribe. */
  readonly currentStep = signal<string | null>(null);
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
    this.threadId = this.chatService.currentThreadId();

    this.chatService.loadHistory(this.threadId).subscribe({
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

  ngOnDestroy(): void {
    // Sin esto, salir de la pantalla a mitad de respuesta deja al agente
    // generando contra un lector que ya no existe.
    this.abort?.abort();
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

    void this.runTurn(text);
  }

  private async runTurn(text: string): Promise<void> {
    this.abort = new AbortController();
    let answerId: string | null = null;

    try {
      await this.chatService.sendTurn(
        this.threadId,
        text,
        {
          onStep: (label) => this.currentStep.set(label),
          onAnswerStart: () => {
            // La respuesta empieza: el indicador de progreso ya no aporta,
            // el texto que aparece es señal suficiente.
            this.currentStep.set(null);
            answerId = crypto.randomUUID();
            this.appendMessage({
              id: answerId,
              role: 'ai',
              text: '',
              timestamp: new Date().toISOString(),
              streaming: true,
            });
          },
          onDelta: (delta) => {
            if (answerId) this.appendDelta(answerId, delta);
          },
        },
        this.abort.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.handleTurnError(error, answerId);
      return;
    } finally {
      this.abort = null;
      this.sending.set(false);
      this.currentStep.set(null);
      if (answerId) this.finishStreaming(answerId);
    }
  }

  private handleTurnError(error: unknown, answerId: string | null): void {
    // Una burbuja vacía a medio escribir es peor que ninguna.
    if (answerId) this.dropIfEmpty(answerId);
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

  private appendDelta(id: string, delta: string): void {
    this.messages.update((msgs) =>
      msgs.map((msg) => (msg.id === id ? { ...msg, text: msg.text + delta } : msg)),
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
