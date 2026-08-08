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

  /**
   * Verificado contra `data/features.csv` de spark-match-05-data-pipeline el 2026-08-08:
   * 554 carreras únicas, 1.071 instituciones únicas y 25 departamentos, sobre 6.208
   * combinaciones carrera-institución. Los dos primeros valores se dejan con "+" a
   * propósito, para que sigan siendo ciertos si el dataset crece.
   *
   * El tercero era «98% Satisfacción» y se ha quitado, no reemplazado por otra estimación:
   * no existe endpoint de feedback ni persistencia de valoraciones, y el modal de estrellas
   * nunca llega a mostrarse porque `isFinalRecommendation` no se asigna en ningún punto.
   * O sea que no se ha recogido ni una sola valoración y ese número no salía de ningún sitio.
   * Vuelve cuando exista la recogida de feedback, con el dato real que produzca.
   *
   * Los tres pasarán a salir de GET /api/stats cuando el backend exponga el catálogo. Hasta
   * entonces son literales y hay que moverlos a mano si el dataset cambia.
   */
  stats = [
    { value: '550+', label: 'Carreras analizadas' },
    { value: '1.000+', label: 'Instituciones' },
    { value: '25', label: 'Regiones del Perú' },
  ];
}
