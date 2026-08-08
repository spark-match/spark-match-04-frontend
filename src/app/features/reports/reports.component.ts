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
    const filters = this.filtersService.currentFilters();
    this.reportsService.getReport(filters).subscribe((report) => {
      this.report.set(report);
      this.loading.set(false);
    });
  }

  exportPdf(): void {
    window.print();
  }
}
