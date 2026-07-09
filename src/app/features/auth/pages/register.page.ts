import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-register',
  imports: [MatButtonModule, MatCardModule],
  template: `
    <div class="auth-page">
      <mat-card>
        <mat-card-title i18n="@@register.title">Crear cuenta</mat-card-title>
        <mat-card-content>
          <p i18n="@@register.placeholder">
            El formulario de registro se implementará en la siguiente fase,
            conectándose al endpoint <code>POST /v1/auth/register</code>.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-page { max-width: 420px; margin: 4rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
    code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPage {}
