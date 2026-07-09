import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPage {
  protected readonly features = signal([
    {
      icon: 'psychology',
      title: 'Cuestionario RIASEC',
      description: 'Descubre tus intereses profesionales con el modelo Holland validado científicamente.'
    },
    {
      icon: 'school',
      title: 'Catálogo de carreras',
      description: 'Explora más de 800 carreras en universidades e institutos de Perú.'
    },
    {
      icon: 'auto_awesome',
      title: 'Matching con IA',
      description: 'Recomendaciones personalizadas basadas en tu perfil vocacional único.'
    }
  ]);
}
