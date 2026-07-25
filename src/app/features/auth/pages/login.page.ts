import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthShellComponent } from '../../../shared/ui/auth-shell/auth-shell.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell>
      <div class="auth-card">
        <div class="auth-card__tabs">
          <a routerLink="/auth/register" class="auth-card__tab">Crear cuenta</a>
          <span class="auth-card__tab auth-card__tab--active">Iniciar sesión</span>
        </div>

        <h2 class="font-display">Bienvenido de vuelta</h2>
        <p class="auth-card__lead">Ingresa a tu cuenta para continuar tu búsqueda.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label class="auth-card__field">
            <span>Correo electrónico</span>
            <input type="email" formControlName="email" placeholder="tucorreo&#64;ejemplo.com" />
          </label>

          <label class="auth-card__field">
            <span>Contraseña</span>
            <input type="password" formControlName="password" placeholder="Mínimo 6 caracteres" />
          </label>

          <button type="submit" class="auth-card__submit" [disabled]="form.invalid || submitting">
            {{ submitting ? 'Ingresando...' : 'Ingresar →' }}
          </button>
        </form>

        <p class="auth-card__switch">
          ¿Aún no tienes cuenta?
          <a routerLink="/auth/register">Regístrate gratis</a>
        </p>
      </div>
    </app-auth-shell>
  `,
  styleUrl: './auth-card.scss',
})
export class LoginPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  submitting = false;

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;

    this.authService
      .login({
        email: this.form.value.email!,
        password: this.form.value.password!,
      })
      .subscribe({
        next: () => {
          // Te redirige a la ruta raíz, la cual ahora te enviará limpiamente a /filters
          this.router.navigate(['/']);
        },
        error: () => {
          this.submitting = false;
        },
        complete: () => {
          // Nos aseguramos de apagar el estado de carga
          this.submitting = false;
        },
      });
  }
}
