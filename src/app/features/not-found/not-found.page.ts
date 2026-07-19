import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  template: `
    <div class="not-found">
      <mat-card>
        <mat-card-content>
          <mat-icon class="big-icon">explore_off</mat-icon>
          <h1 i18n="@@notFound.title">404 - Página no encontrada</h1>
          <p i18n="@@notFound.message">
            La página que buscas no existe o fue movida.
          </p>
          <a mat-flat-button color="primary" routerLink="/" i18n="@@notFound.cta">
            Volver al inicio
          </a>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .not-found {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 2rem;
    }
    mat-card { max-width: 480px; text-align: center; padding: 2rem; }
    .big-icon { font-size: 4rem; width: 4rem; height: 4rem; color: #999; }
    h1 { margin: 1rem 0 0.5rem; }
    p { color: rgba(0,0,0,0.6); margin-bottom: 1.5rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundPage {}
