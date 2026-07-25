import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthShellComponent } from '../../../shared/ui/auth-shell/auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell>
      <div class="auth-card">
        <h2 class="font-display">Recuperar contraseña</h2>
        <p class="auth-card__lead">
          Próximamente disponible. El flujo de recuperación se implementará en la siguiente fase.
        </p>

        <button class="auth-card__submit" routerLink="/auth/login">
          ← Volver a iniciar sesión
        </button>
      </div>
    </app-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-card.scss',
})
export class ForgotPasswordPage {}
