import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-results',
  imports: [MatCardModule],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title i18n="@@results.title">Mis resultados</mat-card-title>
        <mat-card-content>
          <p i18n="@@results.placeholder">
            Tus coincidencias con carreras aparecerán aquí.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { max-width: 1000px; margin: 2rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsPage {}
