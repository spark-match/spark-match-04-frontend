import { Component, input } from '@angular/core';
import { ActivityGroup } from './activity-grouping';
import { activityTimingLabel } from './activity-timing';

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

  activityTiming = activityTimingLabel;
}
