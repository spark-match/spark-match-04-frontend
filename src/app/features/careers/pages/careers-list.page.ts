import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-careers-list',
  imports: [MatCardModule],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title i18n="@@careersList.title">Catálogo de carreras</mat-card-title>
        <mat-card-content>
          <p i18n="@@careersList.placeholder">
            El listado paginado se implementará en la siguiente fase,
            consumiendo <code>GET /v1/careers</code>.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; margin: 2rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
    code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CareersListPage {}
