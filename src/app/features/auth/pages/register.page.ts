import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthShellComponent } from '../../../shared/ui/auth-shell/auth-shell.component';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell>
      <div class="auth-card">
        <div class="auth-card__tabs">
          <span class="auth-card__tab auth-card__tab--active">Crear cuenta</span>
          <a routerLink="/auth/login" class="auth-card__tab">Iniciar sesión</a>
        </div>

        <h2 class="font-display">Empieza gratis</h2>
        <p class="auth-card__lead">Cuéntanos lo básico para personalizar tus recomendaciones.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label class="auth-card__field">
            <span>Nombre completo</span>
            <input type="text" formControlName="fullName" placeholder="Ej: Ana Quispe" />
          </label>

          <label class="auth-card__field">
            <span>Correo electrónico</span>
            <input type="email" formControlName="email" placeholder="tucorreo&#64;ejemplo.com" />
          </label>

          <label class="auth-card__field">
            <span>Contraseña</span>
            <input type="password" formControlName="password" placeholder="Mínimo 6 caracteres" />
          </label>

          <div class="auth-card__row">
            <label class="auth-card__field">
              <span>Edad</span>
              <input type="number" formControlName="age" min="14" max="99" />
            </label>

            <label class="auth-card__field">
              <span>Región</span>
              <select formControlName="region">
                <option value="" disabled>Selecciona...</option>
                <option *ngFor="let region of regions" [value]="region">{{ region }}</option>
              </select>
            </label>
          </div>

          <label class="auth-card__field">
            <span>Área de interés (opcional)</span>
            <input
              type="text"
              formControlName="interestArea"
              placeholder="Ej: tecnología, salud, negocios..."
            />
          </label>

          <button type="submit" class="auth-card__submit" [disabled]="form.invalid || submitting">
            {{ submitting ? 'Creando cuenta...' : 'Crear cuenta y continuar →' }}
          </button>
        </form>

        <p class="auth-card__switch">
          ¿Ya tienes cuenta?
          <a routerLink="/auth/login">Inicia sesión</a>
        </p>
      </div>
    </app-auth-shell>
  `,
  styleUrl: './auth-card.scss',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  submitting = false;

  // TODO: reemplazar por el catálogo real de regiones que exponga el backend
  // (mismo catálogo que expone FiltersService.getRegions())
  regions = ['Lima Metropolitana', 'Arequipa', 'La Libertad', 'Piura', 'Cusco', 'Junín'];

  form = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    age: [17, [Validators.required, Validators.min(14)]],
    region: ['', Validators.required],
    interestArea: [''],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting = true;

    this.authService
      .register({
        fullName: this.form.value.fullName!,
        email: this.form.value.email!,
        password: this.form.value.password!,
        age: this.form.value.age!,
        region: this.form.value.region!,
        interestArea: this.form.value.interestArea || undefined,
      })
      .subscribe({
        next: () => this.router.navigate(['/filters']),
        error: () => (this.submitting = false),
      });
  }
}
