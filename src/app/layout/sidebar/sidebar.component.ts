import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Toolbar, ToolbarWidget } from '@angular/aria/toolbar';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  label: string;
  icon: string;
  path: string;
}

interface RecentChat {
  title: string;
  when: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Toolbar, ToolbarWidget],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.user;
  collapsed = signal(false);
  adminMode = signal(false);
  mlopsOpen = signal(true);

  // reemplazar por datos reales de /api/chats cuando el backend esté listo
  navItems: NavItem[] = [
    { label: 'Inicio', icon: 'sparkles', path: '/home' },
    { label: 'Filtros', icon: 'sliders', path: '/filters' },
    { label: 'Chat', icon: 'chat', path: '/assessment' },
    { label: 'Reporte', icon: 'file', path: '/results' },
    { label: 'Mi perfil', icon: 'user', path: '/profile' },
  ];

  recentChats: RecentChat[] = [
    { title: 'Ingeniería vs Medicina', when: 'Hoy' },
    { title: 'Universidades en Arequipa', when: 'Ayer' },
    { title: 'Presupuesto para privada', when: 'Hace 3 días' },
    { title: 'Carreras con mayor sueldo', when: 'Hace 5 días' },
  ];

  promptVersions = ['v2.4', 'v2.3', 'v2.2'];
  scoringFormulas = ['v3', 'v2', 'v1'];
  selectedPromptVersion = signal(this.promptVersions[0]);
  selectedScoringFormula = signal(this.scoringFormulas[0]);
  relevanceScore = signal(72);

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
