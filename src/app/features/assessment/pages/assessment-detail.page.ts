import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-assessment-detail',
  imports: [MatCardModule],
  template: `
    <div class="page">
      <mat-card>
        <mat-card-title i18n="@@assessmentDetail.title">Detalle del cuestionario</mat-card-title>
        <mat-card-content>
          <p i18n="@@assessmentDetail.placeholder">Próximamente.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { max-width: 800px; margin: 2rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssessmentDetailPage {}
