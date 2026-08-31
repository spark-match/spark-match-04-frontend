import {
  Component,
  ElementRef,
  OnInit,
  afterRenderEffect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Toolbar, ToolbarWidget } from '@angular/aria/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../features/chat/chat.service';
import { ChatSessionsStore, relativeDayLabel } from '../../features/chat/chat-sessions.store';

/**
 * El mismo tope que aplica el agente (`threads/registry.py`).
 *
 * Repetido aquí a propósito: el `maxlength` del input evita que el estudiante
 * escriba treinta caracteres de más para que se los rechacen al enviar. Quien
 * manda sigue siendo el agente — esto sólo evita el viaje.
 */
const MAX_TITULO = 60;

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Toolbar, ToolbarWidget],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sessions = inject(ChatSessionsStore);
  private readonly chatService = inject(ChatService);

  /** Las conversaciones reales del usuario, no la maqueta de antes. */
  readonly recentChats = this.sessions.threads;

  user = this.authService.user;

  /**
   * Solo `admin` ve el panel. Falla cerrado: sin rol, no eres admin.
   *
   * Antes no habia comprobacion ninguna, asi que cualquier estudiante veia la
   * casilla y, al marcarla, un panel de MLOps con versiones de prompt y
   * formulas de scoring inventadas.
   */
  readonly isAdmin = this.authService.isAdmin;

  readonly collapsed = signal(false);
  readonly adminMode = signal(false);
  readonly mlopsOpen = signal(true);

  /** Id de la conversación que se está renombrando, o `null`. */
  readonly renombrando = signal<string | null>(null);
  readonly renameError = this.sessions.renameError;

  /**
   * Id de la conversación que está preguntando si de verdad se borra.
   *
   * La confirmación se pide en la propia fila y no con un diálogo, por lo
   * mismo que el renombrado se edita en el sitio: la pregunta se lee justo
   * encima del nombre al que se refiere, y así no hay que nombrarlo dentro
   * del mensaje ni sacar al estudiante de donde estaba.
   */
  readonly confirmandoBorrado = signal<string | null>(null);
  readonly deleteError = this.sessions.deleteError;

  /** El mismo tope que el agente, para que el input no deje escribir de más. */
  readonly MAX_TITULO = MAX_TITULO;

  private readonly entradaDeTitulo = viewChild<ElementRef<HTMLInputElement>>('entradaDeTitulo');

  constructor() {
    // El input aparece porque cambió una señal, así que hay que esperar al
    // repintado para poder enfocarlo: en el momento de pulsar todavía no
    // existe en el DOM. Y se selecciona el texto entero — quien renombra
    // suele querer otro nombre, no añadir al que hay.
    afterRenderEffect(() => {
      if (!this.renombrando()) return;
      const input = this.entradaDeTitulo()?.nativeElement;
      if (input && document.activeElement !== input) {
        input.focus();
        input.select();
      }
    });
  }

  navItems: NavItem[] = [
    { label: 'Inicio', icon: 'sparkles', path: '/home' },
    { label: 'Filtros', icon: 'sliders', path: '/filters' },
    { label: 'Chat', icon: 'chat', path: '/assessment' },
    { label: 'Reportes', icon: 'file', path: '/results' },
    { label: 'Mi perfil', icon: 'user', path: '/profile' },
  ];

  promptVersions = ['v2.4', 'v2.3', 'v2.2'];
  scoringFormulas = ['v3', 'v2', 'v1'];
  readonly selectedPromptVersion = signal(this.promptVersions[0]);
  readonly selectedScoringFormula = signal(this.scoringFormulas[0]);
  readonly relevanceScore = signal(72);

  ngOnInit(): void {
    this.sessions.refresh();
  }

  /** Etiqueta de la columna derecha: "Hoy", "Ayer", "Hace 3 días". */
  whenLabel(iso: string): string {
    return relativeDayLabel(iso);
  }

  empezarARenombrar(threadId: string): void {
    this.sessions.renameError.set(null);
    this.renombrando.set(threadId);
  }

  cancelarRenombrado(): void {
    // Antes que el `blur` que provocará quitar el input de la pantalla: ese
    // `blur` llama a `confirmarRenombrado`, y si esto no hubiera pasado ya,
    // Escape acabaría guardando justo lo que se quería descartar.
    this.renombrando.set(null);
  }

  /**
   * Guarda el nombre nuevo, si es que hay uno.
   *
   * Lo llaman Enter y el `blur`, y con Escape llega también un `blur` — de
   * ahí la primera guarda. Sin ella, cada renombrado se mandaría dos veces y
   * un Escape guardaría en vez de descartar.
   */
  confirmarRenombrado(threadId: string, propuesto: string): void {
    if (this.renombrando() !== threadId) return;
    this.renombrando.set(null);

    const limpio = propuesto.trim();
    // Vacío es «no quería cambiarlo», no «llámala vacío». Igual el título de
    // siempre: mandar un PATCH para dejarlo como estaba es ruido.
    if (!limpio || limpio === this.tituloActual(threadId)) return;

    this.sessions.rename(threadId, limpio);
  }

  private tituloActual(threadId: string): string | undefined {
    return this.recentChats().find((chat) => chat.thread_id === threadId)?.title;
  }

  pedirConfirmacionDeBorrado(threadId: string): void {
    this.sessions.deleteError.set(null);
    // Renombrar y borrar a la vez sobre la misma fila no significa nada, y
    // dejar el input abierto detrás de la pregunta haría que el `blur` del
    // botón de confirmar guardara un renombrado que nadie pidió.
    this.renombrando.set(null);
    this.confirmandoBorrado.set(threadId);
  }

  cancelarBorrado(): void {
    this.confirmandoBorrado.set(null);
  }

  /**
   * Borra de verdad, y saca al estudiante de la conversación si era la suya.
   *
   * Quedarse en `/assessment/<id>` de algo que ya no existe deja una pantalla
   * con mensajes que no se pueden continuar: el siguiente turno iría a un
   * hilo que el agente ya no reconoce. Se abre uno nuevo, que es donde
   * cualquiera querría acabar después de borrar el que estaba leyendo.
   */
  confirmarBorrado(threadId: string): void {
    this.confirmandoBorrado.set(null);
    const eraElAbierto = this.elHiloAbierto() === threadId;

    this.sessions.delete(threadId);

    if (eraElAbierto) this.newChat();
  }

  /**
   * La conversación que se está viendo ahora mismo, o `null`.
   *
   * `null` también cuando el estudiante está en otra pantalla: borrar un chat
   * viejo desde el perfil no debería mandarle al chat.
   */
  private elHiloAbierto(): string | null {
    const [ruta] = this.router.url.split('?');
    const partes = ruta.split('/').filter(Boolean);
    if (partes[0] !== 'assessment') return null;

    // Sin id en la ruta, el chat abre el que tenga guardado. Preguntarselo al
    // servicio no crea ninguno de mas: para estar aqui, el chat ya lo hizo.
    return partes[1] ?? this.chatService.currentThreadId();
  }

  openChat(threadId: string): void {
    this.router.navigate(['/assessment', threadId]);
  }

  newChat(): void {
    // El id se crea aquí y no en el chat para que la ruta ya lo lleve: así
    // recargar sobre esa URL sigue en la conversación nueva y no crea otra.
    this.router.navigate(['/assessment', this.chatService.startNewThread()]);
  }

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  toggleAdminMode(): void {
    this.adminMode.update((v) => !v);
  }

  toggleMlops(): void {
    this.mlopsOpen.update((v) => !v);
  }

  onScoreChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.relevanceScore.set(value);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
