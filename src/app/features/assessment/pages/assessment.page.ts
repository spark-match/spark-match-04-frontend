import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-assessment',
  imports: [MatCardModule, MatIconModule],
  template: `
    <div class="assessment">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>quiz</mat-icon>
          <mat-card-title i18n="@@assessment.title">Cuestionario RIASEC</mat-card-title>
          <mat-card-subtitle i18n="@@assessment.subtitle">
            Descubre tu perfil vocacional
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@assessment.placeholder">
            El cuestionario se implementará en la siguiente fase,
            consumiendo el endpoint <code>POST /v1/assessment/start</code>.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .assessment { max-width: 800px; margin: 2rem auto; padding: 1.5rem; }
    mat-card { padding: 2rem; }
    code { background: #f5f5f5; padding: 0.1rem 0.3rem; border-radius: 3px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssessmentPage {}
