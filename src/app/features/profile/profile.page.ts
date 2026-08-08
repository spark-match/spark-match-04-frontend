import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-profile',
  imports: [],
  template: `
    <div class="profile">
      @if (user(); as user) {
        <section class="profile__card">
          <div class="profile__avatar" aria-hidden="true">
            {{ user.fullName.charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="profile__eyebrow">Cuenta de Spark Match</p>
            <h1>Mi perfil</h1>
            <p class="profile__lead">Información de la sesión actual.</p>
          </div>

          <dl class="profile__details">
            <div>
              <dt>Nombre</dt>
              <dd>{{ user.fullName }}</dd>
            </div>
            <div>
              <dt>Correo electrónico</dt>
              <dd>{{ user.email }}</dd>
            </div>
            <div>
              <dt>Edad</dt>
              <dd>{{ user.age ?? 17 }} años</dd>
            </div>
            <div>
              <dt>Región</dt>
              <dd>{{ user.region || 'Lima Metropolitana' }}</dd>
            </div>
            <div>
              <dt>Área de interés</dt>
              <dd>{{ user.interestArea || 'Tecnología e innovación' }}</dd>
            </div>
          </dl>
        </section>
      }
    </div>
  `,
  styles: [
    `
      .profile {
        width: min(100%, 1120px);
        min-height: 100%;
        margin-inline: auto;
        padding: clamp(1.5rem, 4vw, 3rem);
      }
      .profile__card {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1rem 1.25rem;
        padding: clamp(1.5rem, 4vw, 2.5rem);
        border-radius: var(--radius);
        background: var(--card);
        box-shadow: var(--shadow-card);
      }
      .profile__avatar {
        width: 64px;
        height: 64px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--teal-glow);
        color: var(--sidebar-bg);
        font-size: 1.5rem;
        font-weight: 700;
      }
      .profile__eyebrow {
        margin: 0 0 0.2rem;
        color: var(--teal-deep);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      h1 {
        margin: 0;
        font-family: var(--font-display);
        font-size: 2rem;
      }
      .profile__lead {
        margin: 0.25rem 0 0;
        color: oklch(0.5 0.02 240);
      }
      .profile__details {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.25rem;
        margin: 1rem 0 0;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
      }
      .profile__details div {
        min-width: 0;
        padding: 0.85rem 1rem;
        border-radius: 0.75rem;
        background: var(--input);
      }
      dt {
        margin-bottom: 0.25rem;
        color: oklch(0.5 0.02 240);
        font-size: 0.75rem;
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
        font-weight: 600;
      }
      @media (max-width: 760px) {
        .profile__details {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 560px) {
        .profile {
          padding: 1.5rem;
        }
        .profile__card {
          grid-template-columns: 1fr;
        }
        .profile__details {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  protected readonly user = this.auth.user;
}
