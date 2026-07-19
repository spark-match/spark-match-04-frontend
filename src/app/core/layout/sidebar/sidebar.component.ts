import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../auth/auth.service'; // Ajusta esta ruta si es diferente

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
  // Inyectamos el servicio de autenticación que usabas en app.html
  public auth = inject(AuthService);

  // Traemos el array de items que tenías en app.ts
  public navItems = [
    { path: '/', label: 'Inicio', icon: '✨', protected: false },
    { path: '/filters', label: 'Filtros', icon: '🎛️', protected: false },
    { path: '/chat', label: 'Chat', icon: '💬', protected: true },
    { path: '/reports', label: 'Reporte', icon: '📄', protected: true },
  ];
}
