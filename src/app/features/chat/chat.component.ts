import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { ActivityGroup, groupActivities } from './activity-grouping';
import { ActivityListComponent } from './activity-list.component';
import { ChatActivity, ChatMessage } from './chat.model';
import { AgUiSnapshotMessage } from '../../core/agent/ag-ui.model';
import { AgentStreamError, agentErrorMessage } from '../../core/agent/ag-ui.client';
import { INITIAL_STEP_LABEL } from '../../core/agent/step-labels';
import { AuthService } from '../../core/auth/auth.service';
import { MarkdownPipe } from '../../shared/markdown.pipe';
import { ChatSessionsStore } from './chat-sessions.store';
import { estaPegadoAlFondo } from './scroll-anchoring';
import { Subscription, timer } from 'rxjs';
import { switchMap, take, takeWhile } from 'rxjs/operators';

/**
 * Lo que el chat promete en su primera frase.
 *
 * Decía: «Usamos datos oficiales de Ponte en Carrera del Ministerio de
 * Educación para darte recomendaciones basadas en el mercado laboral real
 * peruano». Era falso de punta a punta. El agente no tenía ni un dato del
 * MINEDU: su catálogo eran 20 fichas genéricas, sin una sola universidad,
 * sin un sueldo y sin un costo, y con recursos de Harvard.
 *
 * Ya sí los tiene — 6208 carreras en universidades e institutos de los 25
 * departamentos (`spark-match-08-deep-agent#71`) — así que el texto de ahora
 * dice lo que hay y lo dice en concreto.
 *
 * Lo que NO vuelve es la promesa de sueldos. Están en el dataset, pero el
 * 73% son la mediana de la familia de carrera y no una medición de ese
 * programa. El agente los da con esa advertencia cuando vienen a cuento;
 * anunciarlos en la frase de bienvenida los convertiría en el gancho, y un
 * gancho no admite matices.
 */
const WELCOME_TEXT =
  '¡Hola! Soy tu orientador vocacional con IA. Busco entre 6208 carreras de universidades ' +
  'e institutos de los 25 departamentos del Perú, con datos del portal Ponte en Carrera ' +
  'del Ministerio de Educación: cuánto duran, cuánto cuestan y qué tan difícil es entrar. ' +
  '¿Por dónde empezamos?';

/**
 * Cada cuánto se pregunta si el turno en curso ya terminó.
 *
 * Tres segundos: un turno con subagente dura minutos, así que apurar más no
 * adelanta la respuesta y sí multiplica las peticiones. Y esperar más haría
 * que una respuesta ya escrita tardara en aparecer sin motivo.
 */
const SONDEO_MS = 3000;

/**
 * Cuántas veces como mucho. A 3 s son cinco minutos, que es lo que dura el
 * arrendamiento de un turno en el agente: pasado eso, o el turno terminó o su
 * proceso murió, y en los dos casos seguir preguntando no aporta nada.
 */
const SONDEOS_MAXIMOS = 100;

const ESPERA_AGOTADA =
  'La respuesta está tardando más de lo normal. Recarga la página para ver si ya llegó.';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, RouterLink, MarkdownPipe, ActivityListComponent],
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
  private sondeo: Subscription | null = null;

  private readonly cajaDeMensajes = viewChild<ElementRef<HTMLElement>>('cajaDeMensajes');

  /**
   * El lector se subió a releer algo. Mientras esté en true no se le mueve la
   * pantalla por su cuenta, y se le enseña el botón para volver.
   */
  readonly despegado = signal(false);

  /**
   * Hay que aterrizar abajo en el próximo repintado, de golpe y sin animación.
   *
   * Es un booleano suelto y no una señal porque nadie lo lee para pintar: solo
   * marca que el siguiente render es una llegada (abrir una conversación) y no
   * una continuación (un token más). No es lo mismo: al llegar se aterriza
   * abajo aunque el lector estuviera despegado en la conversación anterior.
   */
  private aterrizarAbajo = false;

  draft = '';
  readonly sending = signal(false);
  readonly loadingSession = signal(true);
  readonly messages = signal<ChatMessage[]>([]);
  /** Lo que el agente está haciendo ahora mismo; null cuando ya escribe. */
  readonly currentStep = signal<string | null>(null);
  /** Herramientas del turno en curso: búsquedas web, catálogo, subagentes. */
  readonly activities = signal<ChatActivity[]>([]);
  /**
   * Hay un turno generándose que esta pestaña no está mirando.
   *
   * Se enciende al abrir una conversación cuyo turno sigue vivo — cerraste la
   * pestaña a media respuesta y volviste, o la dejaste abierta en otro sitio.
   * Es distinto de `sending()`, que es un turno lanzado desde aquí y del que
   * llegan tokens.
   */
  readonly turnoEnCurso = signal(false);
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

  constructor() {
    // `afterRenderEffect` y no `effect`: un efecto corriente se ejecuta ANTES
    // de que el DOM tenga las burbujas nuevas, así que `scrollHeight` seguiría
    // valiendo lo de antes y el salto se quedaría corto justo por el mensaje
    // que lo provocó. Aquí el navegador ya midió.
    afterRenderEffect(() => {
      // Depender de los mensajes es lo que hace que esto corra: cada token que
      // llega los reemplaza, y cada reemplazo es una oportunidad de seguir.
      this.messages();

      const caja = this.cajaDeMensajes()?.nativeElement;
      if (!caja) return;

      if (this.aterrizarAbajo) {
        this.aterrizarAbajo = false;
        // Sin `behavior: 'smooth'` a propósito. Al abrir una conversación no
        // estás bajando: estás llegando donde la conversación se quedó, y ver
        // pasar volando cien mensajes que no has leído no es información, es
        // ruido.
        caja.scrollTop = caja.scrollHeight;
        return;
      }

      if (!this.despegado()) caja.scrollTop = caja.scrollHeight;
    });
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
    this.detenerSondeo();
    // Sin esto, salir de la pantalla a mitad de respuesta deja los tokens
    // llegando a un lector que ya no existe. Ojo: desde
    // `spark-match-08-deep-agent#89` esto ya NO corta el turno en el
    // agente, que termina solo — por eso al volver hay algo que sondear.
    this.abort?.abort();
  }

  private openThread(threadId: string): void {
    // Cambiar de conversación cancela lo que quedara corriendo de la
    // anterior; si no, sus tokens seguirían llegando a la pantalla nueva.
    this.abort?.abort();
    this.abort = null;
    this.detenerSondeo();
    this.sending.set(false);
    this.currentStep.set(null);
    this.errorMessage.set(null);

    this.threadId = threadId;
    this.chatService.rememberThread(threadId);
    this.loadingSession.set(true);
    this.messages.set([]);

    this.chatService.loadHistory(threadId).subscribe({
      next: (historial) => {
        this.messages.set(historial.messages.length ? historial.messages : [welcomeMessage()]);
        this.loadingSession.set(false);
        this.aterrizarAbajo = true;
        // El turno sigue vivo en el agente: cerraste la pestaña a media
        // respuesta, o la conversación está abierta en otro sitio. La
        // respuesta va a llegar sola, así que se espera en vez de dejar la
        // pregunta ahí sin nada debajo.
        if (historial.running) this.vigilarTurnoEnCurso(threadId);
      },
      // Que falle el historial no debe dejar al estudiante sin chat: se
      // arranca la conversación igual, solo que sin lo anterior.
      error: () => {
        this.messages.set([welcomeMessage()]);
        this.loadingSession.set(false);
        this.aterrizarAbajo = true;
      },
    });
  }

  /**
   * Espera a que termine un turno que no lanzó esta pestaña.
   *
   * Se sondea el historial en vez de reengancharse al stream porque el turno
   * ya no tiene stream al que volver: sus eventos salieron por una conexión
   * que se cerró. Lo que sí queda es el checkpoint, y ahí aparece la
   * respuesta en cuanto el agente la escribe.
   *
   * El tope existe porque un arrendamiento puede quedar colgado si el
   * proceso del agente muere a mitad, y sondear para siempre dejaría la
   * pantalla bloqueada esperando algo que ya no viene.
   */
  private vigilarTurnoEnCurso(threadId: string): void {
    this.detenerSondeo();
    this.turnoEnCurso.set(true);
    let seguiaCorriendo = true;

    this.sondeo = timer(SONDEO_MS, SONDEO_MS)
      .pipe(
        take(SONDEOS_MAXIMOS),
        switchMap(() => this.chatService.loadHistory(threadId)),
        // El `true` es lo que hace que el sondeo que ya trae la respuesta
        // se emita antes de completar. Sin él se descartaría justo el
        // único que traía algo que enseñar.
        takeWhile((historial) => historial.running, true),
      )
      .subscribe({
        next: (historial) => {
          seguiaCorriendo = historial.running;
          if (historial.messages.length) this.messages.set(historial.messages);
        },
        // Un sondeo que falla no es motivo para dejar la pantalla clavada
        // en «respondiendo»: se apaga el aviso y el estudiante sigue.
        error: () => this.turnoEnCurso.set(false),
        complete: () => {
          this.turnoEnCurso.set(false);
          if (seguiaCorriendo) this.errorMessage.set(ESPERA_AGOTADA);
        },
      });
  }

  private detenerSondeo(): void {
    this.sondeo?.unsubscribe();
    this.sondeo = null;
    this.turnoEnCurso.set(false);
  }

  /**
   * Vigila si el lector sigue abajo.
   *
   * Se marca aquí y no se calcula al pintar porque el efecto de render corre
   * DESPUÉS de que el contenido creció: en ese momento la caja ya no está al
   * fondo aunque el lector no haya tocado nada, y preguntar ahí daría
   * «despegado» en cuanto llega el primer token. Este handler solo se dispara
   * con desplazamientos reales, que es cuando la respuesta significa algo.
   */
  alDesplazar(): void {
    const caja = this.cajaDeMensajes()?.nativeElement;
    if (!caja) return;
    this.despegado.set(!estaPegadoAlFondo(caja));
  }

  /**
   * El botón de volver abajo. Aquí sí con animación: es un gesto que el lector
   * pidió, y ver el recorrido le dice dónde estaba.
   *
   * No se apaga `despegado` a mano: lo pisaría el primer evento de scroll de
   * la propia animación, que todavía está lejos del fondo. Quien lo apaga es
   * `alDesplazar` al llegar, y la plantilla escucha `scrollend` además de
   * `scroll` para que ese último recálculo no dependa de que el navegador
   * emita un evento en el fotograma final.
   */
  irAlUltimo(): void {
    const caja = this.cajaDeMensajes()?.nativeElement;
    caja?.scrollTo({ top: caja.scrollHeight, behavior: 'smooth' });
  }

  send(): void {
    const text = this.draft.trim();
    // `turnoEnCurso` también: el agente rechazaría el segundo turno con un
    // 409, y es mejor no dejar mandarlo que dejarlo y disculparse después.
    if (!text || this.sending() || this.turnoEnCurso()) return;

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
          onToolStart: (toolCallId, label, reason, kind) => {
            // El paso genérico deja de aportar en cuanto se puede decir algo
            // concreto ("Buscando en internet…" en vez de "Pensando…").
            this.currentStep.set(null);
            this.upsertActivity({ id: toolCallId, label, reason, running: true, kind });
          },
          // Los argumentos llegan después del START, así que esto llena el
          // chip que ya está en pantalla en vez de crear otro.
          onToolDetail: (toolCallId, detail) => this.patchActivity(toolCallId, { detail }),
          onToolEnd: (toolCallId) => this.patchActivity(toolCallId, { running: false }),
          onSubagentStart: (toolCallId, label, reason) => {
            this.currentStep.set(null);
            // Mismo `toolCallId` que la tool `task` que lo envuelve, así que
            // esto asciende el chip genérico en vez de duplicarlo.
            this.upsertActivity({ id: toolCallId, label, reason, running: true, kind: 'subagent' });
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

    // Un 409 no es un fallo: dice que hay una respuesta en camino en esta
    // misma conversación. Se pasa a esperarla, que es justo lo que el
    // estudiante querría — el aviso solo, sin nada detrás, sería pedirle
    // que lo reintente a ciegas.
    if (error instanceof AgentStreamError && error.kind === 'busy') {
      this.vigilarTurnoEnCurso(this.threadId);
      return;
    }

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
   * Colapsa llamadas repetidas a la misma herramienta en un chip, para que
   * pintar en el template sea `@for (group of activityGroups(...))` en vez
   * de repetir la lógica de agrupación ahí. Ver `activity-grouping.ts`.
   *
   * Quien pinta los chips es `ActivityListComponent`, y el formateo de la
   * duración vive con él en `activity-timing.ts`: este componente ya sólo
   * decide QUÉ actividades pasa, no cómo se ven.
   */
  activityGroups(activities: ChatActivity[]): ActivityGroup[] {
    return groupActivities(activities);
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
