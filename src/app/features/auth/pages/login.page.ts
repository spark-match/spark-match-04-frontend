import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-login',
  imports: [MatButtonModule, MatCardModule],
  template: `
    <div class="auth-page">
      <mat-card>
        <mat-card-title i18n="@@login.title">Iniciar sesión</mat-card-title>
        <mat-card-content>
          <p i18n="@@login.placeholder">
            El formulario de login se implementará en la siguiente fase,
            conectándose al endpoint <code>POST /v1/auth/login</code>.
          </p>
          <a mat-flat-button color="primary" routerLink="/" i18n="@@login.back">
            Volver
          </a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-page { max-width: 420px; margin: 4rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
    mat-card-title { margin-bottom: 1.5rem; }
    code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage {}
