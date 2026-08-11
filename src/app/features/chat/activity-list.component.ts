import { Component, computed, input, signal } from '@angular/core';
import { ActivityGroup } from './activity-grouping';
import { activityTimingLabel, hayDetalleQueEnsenar } from './activity-timing';
import { resumenDeActividad } from './activity-summary';

/**
 * El `<ul>` de chips de actividad: herramientas que el agente usó o
 * especialistas en los que delegó.
 *
 * Un componente aparte porque este mismo bloque se pinta en dos sitios de
 * `chat.component.html` — la lista «en vivo» mientras el turno corre, y la
 * que queda pegada a la respuesta cuando termina —, y como plantilla
 * duplicada dos veces era justo lo que SonarCloud empezó a marcar como
 * código repetido en cuanto creció con el desplegable de llamadas
 * agrupadas (ver `activity-grouping.ts`).
 */
@Component({
  selector: 'app-activity-list',
  standalone: true,
  templateUrl: './activity-list.component.html',
  styleUrl: './activity-list.component.scss',
})
export class ActivityListComponent {
  readonly groups = input.required<ActivityGroup[]>();
  /** Solo la lista que se sigue actualizando lleva `aria-live`. */
  readonly live = input(false);

  /**
   * El lector abrió el detalle.
   *
   * Arranca plegado a propósito. Antes la lista se acotaba con
   * `max-height: 11rem` y su propia barra de scroll, para que una ristra de
   * herramientas no empujara la respuesta fuera de pantalla — el problema era
   * real, pero la cura se leía como el defecto: una cajita que esconde lo que
   * tiene dentro y obliga a rascar en una barra de scroll enana para verlo.
   *
   * Plegado, la altura está acotada por construcción y no hace falta recortar
   * nada. Y el orden de importancia queda donde debe: lo que el estudiante
   * vino a leer es la respuesta; cómo se obtuvo es una nota al pie que puede
   * abrir si le interesa.
   */
  readonly desplegado = signal(false);

  /** Una línea: qué hizo y cuántos pasos fueron. */
  readonly resumen = computed(() => resumenDeActividad(this.groups()));

  /**
   * Mientras el turno corre no se pliega nada.
   *
   * Ver en vivo lo que el agente está haciendo es justo lo que hace llevadera
   * la espera; esconderlo detrás de un desplegable dejaría al estudiante
   * mirando un hueco en blanco. El plegado es para después, cuando la
   * respuesta ya está y los chips pasan a ser procedencia.
   */
  readonly plegable = computed(() => !this.live() && this.groups().length > 1);

  alternar(): void {
    this.desplegado.update((abierto) => !abierto);
  }

  activityTiming = activityTimingLabel;

  /**
   * Si merece la pena ofrecer el desplegable de un grupo.
   *
   * Agrupar varias llamadas no garantiza que haya nada que enseñar de cada
   * una: ver `hayDetalleQueEnsenar`. Sin esta comprobación, «Organizando el
   * plan · 3 veces» se abría a tres viñetas en blanco.
   */
  hayDetalle(group: ActivityGroup): boolean {
    return hayDetalleQueEnsenar(group.calls);
  }
}
