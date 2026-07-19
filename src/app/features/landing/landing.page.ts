import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HomeCard {
  icon: string;
  title: string;
  example: string;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
})
export class LandingPage {
  cards: HomeCard[] = [
    {
      icon: 'chart',
      title: 'Datos del mercado',
      example: 'Me gustan las matemáticas y quiero ganar bien después de graduarme.',
    },
    {
      icon: 'chat',
      title: 'Chat con IA',
      example: 'Me interesa la tecnología y la salud, ¿qué carreras combinan ambas?',
    },
    {
      icon: 'book',
      title: 'Comparativa',
      example: 'Compara universidades públicas vs privadas para Ingeniería en Lima.',
    },
  ];

  // TODO: estos totales vendrán de GET /api/stats (backend aún no disponible)
  stats = [
    { value: '550+', label: 'Carreras analizadas' },
    { value: '1.000+', label: 'Instituciones' },
    { value: '98%', label: 'Satisfacción' },
  ];
}
