import { Component, OnInit, inject, signal } from '@angular/core';
import { ReportsService } from './reports.service';
import { FiltersService } from '../filters/filters.service';
import { CareerMatch, OrientationReport } from '../careers/career.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private reportsService = inject(ReportsService);
  private filtersService = inject(FiltersService);

  readonly loading = signal(true);
  readonly report = signal<OrientationReport | null>(null);
  readonly failed = signal(false);

  get careers(): CareerMatch[] {
    return this.report()?.careers ?? [];
  }

  get careersFound(): number {
    return this.careers.length;
  }

  get profile(): string {
    return this.report()?.profileSummary ?? '';
  }

  /**
   * La fuente que se muestra en el banner sale del propio dato, no de la plantilla.
   *
   * Estaba escrita a mano ahi -«Datos: Ponte en Carrera 2024»- y por eso sobrevivio a la
   * correccion del 2026-08-08, que solo toco el `source` de cada ficha. Quedaron dos
   * verdades distintas en la misma pantalla: las tarjetas citando la fecha real del
   * snapshot y la cabecera citando una que no existe.
   *
   * Derivarla del reporte hace imposible esa deriva: si cambia la fuente del dato, cambia
   * sola la del banner. Se toma de la primera ficha porque todas comparten la misma; el dia
   * que haya varias fuentes esto tendra que agregarlas, y el test de abajo lo dira.
   */
  get dataSource(): string {
    return this.careers[0]?.source ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  /**
   * Carga —o recarga— el informe.
   *
   * La suscripción lleva rama de `error` a propósito. Hasta el 2026-08-09 solo
   * tenía la de éxito, así que un fallo no bajaba nunca `loading` y la pantalla
   * se quedaba en «Generando tu reporte de orientación...» indefinidamente, sin
   * mensaje y sin salida: ni el usuario sabía que algo había ido mal ni podía
   * hacer nada al respecto.
   *
   * Y no era un caso raro, era EL caso: en los entornos desplegados
   * `useMocks` va en false (`environment.cloud-dev.ts`, `environment.production.ts`)
   * y `GET /reports/latest` todavía no existe en el backend, así que la petición
   * siempre terminaba en 404. El spinner eterno de la captura del usuario es
   * exactamente esto.
   *
   * Es público porque lo llama el botón de reintentar de la plantilla.
   */
  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    const filters = this.filtersService.currentFilters();
    this.reportsService.getReport(filters).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        // El informe anterior se descarta: dejarlo en pantalla junto a un aviso
        // de fallo haría creer que lo que se ve es el resultado del reintento.
        //
        // El detalle del error no se enseña. Puede traer rutas internas del
        // backend, y a un estudiante de secundaria no le dice nada útil; lo que
        // necesita saber es que falló y que puede volver a intentarlo.
        this.report.set(null);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  exportPdf(): void {
    window.print();
  }
}
