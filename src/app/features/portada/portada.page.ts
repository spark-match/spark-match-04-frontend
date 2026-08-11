import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CanalDeContacto, canalesPublicables } from './contacto';

interface Paso {
  numero: string;
  titulo: string;
  texto: string;
}

interface Promesa {
  icono: 'sello' | 'documento' | 'catalogo';
  titulo: string;
  texto: string;
}

/**
 * La portada pública: lo primero que ve alguien que todavía no tiene cuenta.
 *
 * Va **fuera del `AppLayoutComponent`** a propósito. El layout de la aplicación
 * trae la barra lateral con la navegación del producto, y enseñársela a quien
 * no ha entrado es ofrecerle siete sitios a los que no puede ir. Aquí sólo hay
 * dos caminos: crear cuenta o entrar.
 *
 * Tampoco lleva `authGuard`, evidentemente, pero sí sabe si hay sesión: quien
 * ya entró y vuelve a teclear el dominio no tiene por qué encontrarse un
 * «Crear cuenta gratis», así que en ese caso los botones llevan al panel. No se
 * le redirige: aterrizar en un sitio distinto del que escribiste desconcierta
 * más de lo que ahorra.
 */
@Component({
  selector: 'app-portada-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './portada.page.html',
  styleUrl: './portada.page.scss',
})
export class PortadaPage {
  private readonly auth = inject(AuthService);

  /** Se reexpone tal cual: `isAuthenticated` ya es un `computed` del servicio. */
  readonly conSesion = this.auth.isAuthenticated;

  readonly canales: CanalDeContacto[] = canalesPublicables();

  readonly pasos: Paso[] = [
    {
      numero: '01',
      titulo: 'Cuentas quién eres',
      texto:
        'Un cuestionario corto sobre lo que se te da bien y lo que te aburre. De ahí sale tu ' +
        'perfil de intereses — el modelo RIASEC, el mismo que usan los orientadores.',
    },
    {
      numero: '02',
      titulo: 'Pones tus condiciones',
      texto:
        'Región, presupuesto anual, universidad o instituto, pública o privada. Lo que no ' +
        'filtres se compara igual: los filtros acotan, no descartan a ciegas.',
    },
    {
      numero: '03',
      titulo: 'Conversas con la IA',
      texto:
        'Pregunta lo que quieras sobre las opciones que salgan. Compara dos carreras, pide ' +
        'que te expliquen una cifra, cambia un filtro y mira qué se mueve.',
    },
    {
      numero: '04',
      titulo: 'Te llevas el informe',
      texto:
        'Un PDF con tus carreras recomendadas, sus cifras y de dónde sale cada una. Se ' +
        'guarda, se imprime y se enseña en casa.',
    },
  ];

  readonly promesas: Promesa[] = [
    {
      icono: 'sello',
      titulo: 'Cada cifra dice de dónde viene',
      texto:
        'Sueldos, costos, duración y tasas de admisión salen de Ponte en Carrera (MINEDU). ' +
        'Y cuando el portal no publica un dato, lo verás marcado como estimado en vez de ' +
        'colado entre los demás.',
    },
    {
      icono: 'documento',
      titulo: 'Un informe, no una captura de pantalla',
      texto:
        'La orientación no termina cuando cierras el chat. Te llevas un documento con tu ' +
        'perfil, las carreras, sus números y las advertencias — para releerlo dentro de un ' +
        'mes o para discutirlo con tu familia.',
    },
    {
      icono: 'catalogo',
      titulo: 'El catálogo entero, no una lista corta',
      texto:
        'Se compara contra los 6.208 programas del catálogo nacional. Si un filtro te deja ' +
        'fuera opciones, el informe te dice cuántas y cuál las quitó.',
    },
  ];

  /**
   * Verificado contra `data/features.csv` de spark-match-05-data-pipeline el 2026-08-08:
   * 554 carreras únicas, 1.071 instituciones únicas y 25 departamentos, sobre 6.208
   * combinaciones carrera-institución. Los dos primeros van con «+» a propósito, para
   * que sigan siendo ciertos si el dataset crece.
   *
   * Son los mismos de `features/landing` (la página de dentro). Pasarán a salir de
   * `GET /api/stats` cuando el backend exponga el catálogo; hasta entonces son
   * literales y hay que moverlos a mano en los dos sitios si el dataset cambia.
   */
  readonly cifras = [
    { valor: '550+', etiqueta: 'Carreras analizadas' },
    { valor: '1.000+', etiqueta: 'Instituciones' },
    { valor: '25', etiqueta: 'Regiones del Perú' },
  ];
}
