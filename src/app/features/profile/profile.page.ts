import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-profile',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="profile">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>account_circle</mat-icon>
          <mat-card-title i18n="@@profile.title">Mi perfil</mat-card-title>
          <mat-card-subtitle i18n="@@profile.subtitle">
            Gestiona tu información personal
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p i18n="@@profile.placeholder">
            El componente de perfil se implementará en la siguiente fase.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .profile { max-width: 800px; margin: 2rem auto; padding: 1.5rem; }
    mat-card { padding: 1rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePage {}
