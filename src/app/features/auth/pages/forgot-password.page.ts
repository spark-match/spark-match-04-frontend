import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-forgot-password',
  imports: [MatCardModule],
  template: `
    <div class="auth-page">
      <mat-card>
        <mat-card-title i18n="@@forgotPassword.title">Recuperar contraseña</mat-card-title>
        <mat-card-content>
          <p i18n="@@forgotPassword.placeholder">
            Próximamente disponible.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-page { max-width: 420px; margin: 4rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordPage {}
