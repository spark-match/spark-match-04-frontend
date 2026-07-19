import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { SidebarComponent } from './core/layout/sidebar/sidebar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Solo necesitamos el auth aquí para los botones de "Iniciar Sesión" y "Mi Perfil" del header
  protected readonly auth = inject(AuthService);
}
