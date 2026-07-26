import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import {
  FormField,
  email,
  form,
  max,
  min,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { AuthShellComponent } from '../../../shared/ui/auth-shell/auth-shell.component';
import { AuthService } from '../../../core/auth/auth.service';

interface RegisterModel {
  fullName: string;
  email: string;
  password: string;
  age: number;
  region: string;
  interestArea: string;
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [RouterLink, AuthShellComponent, FormField],
  template: `
    <app-auth-shell>
      <div class="auth-card">
        <div class="auth-card__tabs">
          <span class="auth-card__tab auth-card__tab--active">Crear cuenta</span>
          <a routerLink="/auth/login" class="auth-card__tab">Iniciar sesión</a>
        </div>

        <h2 class="font-display">Empieza gratis</h2>
        <p class="auth-card__lead">Cuéntanos lo básico para personalizar tus recomendaciones.</p>

        <form (submit)="submit($event)">
          <label class="auth-card__field">
            <span>Nombre completo</span>
            <input
              type="text"
              [formField]="registerForm.fullName"
              placeholder="Ej: Ana Quispe"
            />
          </label>
          @if (registerForm.fullName().touched() && registerForm.fullName().invalid()) {
            <p class="auth-card__error" role="alert">
              {{ registerForm.fullName().errors()[0].message }}
            </p>
          }

          <label class="auth-card__field">
            <span>Correo electrónico</span>
            <input
              type="email"
              [formField]="registerForm.email"
              placeholder="tucorreo&#64;ejemplo.com"
            />
          </label>
          @if (registerForm.email().touched() && registerForm.email().invalid()) {
            <p class="auth-card__error" role="alert">
              {{ registerForm.email().errors()[0].message }}
            </p>
          }

          <label class="auth-card__field">
            <span>Contraseña</span>
            <input
              type="password"
              [formField]="registerForm.password"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          @if (registerForm.password().touched() && registerForm.password().invalid()) {
            <p class="auth-card__error" role="alert">
              {{ registerForm.password().errors()[0].message }}
            </p>
          }

          <div class="auth-card__row">
            <label class="auth-card__field">
              <span>Edad</span>
              <input
                type="number"
                [formField]="registerForm.age"
              />
            </label>
            @if (registerForm.age().touched() && registerForm.age().invalid()) {
              <p class="auth-card__error" role="alert">
                {{ registerForm.age().errors()[0].message }}
              </p>
            }

            <label class="auth-card__field">
              <span>Región</span>
              <select [formField]="registerForm.region">
                <option value="" disabled>Selecciona...</option>
                @for (region of regions; track region) {
                  <option [value]="region">{{ region }}</option>
                }
              </select>
            </label>
            @if (registerForm.region().touched() && registerForm.region().invalid()) {
              <p class="auth-card__error" role="alert">
                {{ registerForm.region().errors()[0].message }}
              </p>
            }
          </div>

          <label class="auth-card__field">
            <span>Área de interés (opcional)</span>
            <input
              type="text"
              [formField]="registerForm.interestArea"
              placeholder="Ej: tecnología, salud, negocios..."
            />
          </label>

          <button
            type="submit"
            class="auth-card__submit"
            [disabled]="submitting()"
          >
            {{ submitting() ? 'Creando cuenta...' : 'Crear cuenta y continuar →' }}
          </button>
        </form>

        <p class="auth-card__switch">
          ¿Ya tienes cuenta?
          <a routerLink="/auth/login">Inicia sesión</a>
        </p>
      </div>
    </app-auth-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-card.scss',
})
export class RegisterPage {
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly submitting = signal(false);

  // TODO: reemplazar por el catálogo real de regiones que exponga el backend
  // (mismo catálogo que expone FiltersService.getRegions())
  regions = ['Lima Metropolitana', 'Arequipa', 'La Libertad', 'Piura', 'Cusco', 'Junín'];

  readonly registerModel = signal<RegisterModel>({
    fullName: '',
    email: '',
    password: '',
    age: 17,
    region: '',
    interestArea: '',
  });

  readonly registerForm = form(this.registerModel, (f) => {
    required(f.fullName, { message: 'Ingresa tu nombre completo' });
    required(f.email, { message: 'Ingresa tu correo electrónico' });
    email(f.email, { message: 'El correo no es válido' });
    required(f.password, { message: 'Ingresa una contraseña' });
    minLength(f.password, 6, { message: 'La contraseña debe tener al menos 6 caracteres' });
    required(f.age, { message: 'Ingresa tu edad' });
    min(f.age, 14, { message: 'Debes tener al menos 14 años' });
    max(f.age, 99, { message: 'Ingresa una edad válida' });
    required(f.region, { message: 'Selecciona tu región' });
  });

  async submit(event?: Event): Promise<void> {
    event?.preventDefault();
    await submit(this.registerForm, async (field) => {
      this.submitting.set(true);
      const value = field().value();
      try {
        await firstValueFrom(
          this.authService.register({
            fullName: value.fullName,
            email: value.email,
            password: value.password,
            age: value.age,
            region: value.region,
            interestArea: value.interestArea || undefined,
          }),
        );
        await this.router.navigate(['/filters']);
        return [];
      } catch {
        this.submitting.set(false);
        return [{ kind: 'register', message: 'No pudimos crear tu cuenta' }];
      }
    });
  }
}
