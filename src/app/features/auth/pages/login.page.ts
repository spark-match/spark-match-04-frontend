import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, minLength, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthShellComponent } from '../../../shared/ui/auth-shell/auth-shell.component';
import { AuthService } from '../../../core/auth/auth.service';

interface LoginModel {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [RouterLink, AuthShellComponent, FormField],
  template: `
    <app-auth-shell>
      <div class="auth-card">
        <div class="auth-card__tabs">
          <a routerLink="/auth/register" class="auth-card__tab">Crear cuenta</a>
          <span class="auth-card__tab auth-card__tab--active">Iniciar sesión</span>
        </div>

        <h2 class="font-display">Bienvenido de vuelta</h2>
        <p class="auth-card__lead">Ingresa a tu cuenta para continuar tu búsqueda.</p>

        <form (submit)="submit($event)">
          <label class="auth-card__field">
            <span>Correo electrónico</span>
            <input
              type="email"
              [formField]="loginForm.email"
              placeholder="tucorreo&#64;ejemplo.com"
            />
          </label>
          @if (loginForm.email().touched() && loginForm.email().invalid()) {
            <p class="auth-card__error" role="alert">
              {{ loginForm.email().errors()[0].message }}
            </p>
          }

          <label class="auth-card__field">
            <span>Contraseña</span>
            <input
              type="password"
              [formField]="loginForm.password"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          @if (loginForm.password().touched() && loginForm.password().invalid()) {
            <p class="auth-card__error" role="alert">
              {{ loginForm.password().errors()[0].message }}
            </p>
          }

          <button type="submit" class="auth-card__submit" [disabled]="submitting()">
            {{ submitting() ? 'Ingresando...' : 'Ingresar →' }}
          </button>
        </form>

        <p class="auth-card__switch">
          ¿Aún no tienes cuenta?
          <a routerLink="/auth/register">Regístrate gratis</a>
        </p>
      </div>
    </app-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-card.scss',
})
export class LoginPage {
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly submitting = signal(false);

  readonly loginModel = signal<LoginModel>({ email: '', password: '' });

  readonly loginForm = form(this.loginModel, (f) => {
    required(f.email, { message: 'Ingresa tu correo electrónico' });
    email(f.email, { message: 'El correo no es válido' });
    required(f.password, { message: 'Ingresa tu contraseña' });
    minLength(f.password, 6, { message: 'La contraseña debe tener al menos 6 caracteres' });
  });

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    await submit(this.loginForm, async (field) => {
      this.submitting.set(true);
      const value = field().value();
      try {
        await firstValueFrom(
          this.authService.login({ email: value.email, password: value.password }),
        );
        // `/home` y no `/`: la raíz es la portada pública desde que existe, y
        // acabar de entrar para aterrizar en la página que te invita a crear
        // una cuenta se lee como que el acceso no funcionó.
        await this.router.navigate(['/home']);
        return [];
      } catch {
        this.submitting.set(false);
        return [{ kind: 'login', message: 'No pudimos validar tus credenciales' }];
      }
    });
  }
}
