import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';

import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    MatListModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  protected readonly auth = inject(AuthService);

  protected readonly navItems = [
    { path: '/', icon: 'home', label: $localize`:@@nav.home:Inicio` },
    { path: '/assessment', icon: 'quiz', label: $localize`:@@nav.assessment:Cuestionario`, protected: true },
    { path: '/careers', icon: 'school', label: $localize`:@@nav.careers:Carreras` },
    { path: '/results', icon: 'insights', label: $localize`:@@nav.results:Resultados`, protected: true }
  ];
}
