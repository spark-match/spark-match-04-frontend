import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Toolbar, ToolbarWidget } from '@angular/aria/toolbar';
import { AuthService } from '../../core/auth/auth.service';
import { ChatService } from '../../features/chat/chat.service';
import { ChatSessionsStore, relativeDayLabel } from '../../features/chat/chat-sessions.store';

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

  navItems: NavItem[] = [
    { label: 'Inicio', icon: 'sparkles', path: '/home' },
    { label: 'Filtros', icon: 'sliders', path: '/filters' },
    { label: 'Chat', icon: 'chat', path: '/assessment' },
    { label: 'Reporte', icon: 'file', path: '/results' },
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
