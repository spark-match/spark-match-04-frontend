import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ReportsService } from './reports.service';
import {
  Report,
  ReportContent,
  ReportContentCareer,
  esTerminal,
  etiquetaDeProcedencia,
} from './report.model';

/**
 * Los cinco estados que puede tener esta pantalla.
 *
 * Antes eran tres booleanos sueltos (`loading`, `failed`, y `report` en null),
 * que permiten combinaciones que no significan nada — cargando y fallido a la
 * vez, por ejemplo. Con un estado único eso deja de ser representable.
 *
 * `sin-informe` es nuevo y es el caso que antes no existía: un estudiante que
 * todavía no ha pedido ninguno. Antes caía en el mismo saco que un fallo, y se
 * le decía «No pudimos generar tu reporte» a alguien que nunca lo pidió.
 */
export type EstadoDeLaPantalla = 'cargando' | 'sin-informe' | 'generando' | 'listo' | 'fallido';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private readonly reportsService = inject(ReportsService);

  readonly estado = signal<EstadoDeLaPantalla>('cargando');
  readonly informe = signal<Report | null>(null);
  readonly contenido = signal<ReportContent | null>(null);
  readonly descargando = signal(false);

  private readonly suscripciones = new Subscription();

  readonly careers = computed<ReportContentCareer[]>(() => this.contenido()?.careers ?? []);
  readonly careersFound = computed(() => this.careers().length);
  readonly profile = computed(() => this.contenido()?.profile_summary ?? '');

  /**
   * El retrato del perfil, partido en párrafos.
   *
   * Llega como un solo texto con saltos de línea dentro —el prompt del
   * redactor le pide dos o tres párrafos— y pintarlo en un único `<p>` daba
   * un muro de veinte líneas. Se parte por líneas en blanco; si no hay
   * ninguna, sale un solo párrafo, que es exactamente lo que había antes.
   */
  readonly parrafosDelPerfil = computed(() =>
    this.profile()
      .split(/\n\s*\n/)
      .map((parrafo) => parrafo.trim())
      .filter((parrafo) => parrafo.length > 0),
  );

  /**
   * La procedencia se compone de los dos campos de la FILA, no del contenido.
   *
   * Antes salía de `careers[0].source`, un campo por ficha que el contrato real
   * no tiene. Y antes de eso estaba escrita a mano en la plantilla, que fue lo
   * que dejó dos verdades distintas en la misma pantalla el 2026-08-08: las
   * tarjetas citando la fecha real del snapshot y la cabecera citando otra que
   * no existía. Derivarla de un solo sitio hace imposible esa deriva.
   */
  readonly dataSource = computed(() => {
    const fila = this.informe();
    return etiquetaDeProcedencia(fila?.datasetSource ?? null, fila?.datasetSnapshotDate ?? null);
  });

  /**
   * El motivo del fallo, solo si el backend dio uno.
   *
   * Se enseña porque aquí sí es accionable —«tu perfil aún no tiene código
   * RIASEC» le dice al estudiante qué hacer— a diferencia del detalle de un
   * error de red, que solo lleva rutas internas.
   */
  readonly motivoDelFallo = computed(() => this.informe()?.failureReason ?? '');

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    // Sin esto, el sondeo sigue vivo despues de salir de la pantalla: cada
    // dos segundos, una peticion mas, para siempre.
    this.suscripciones.unsubscribe();
  }

  /** Carga —o recarga— el informe más reciente. Público: lo llama el botón de reintentar. */
  load(): void {
    this.estado.set('cargando');
    this.contenido.set(null);

    this.suscripciones.add(
      this.reportsService.list().subscribe({
        next: (informes) => {
          const ultimo = informes[0] ?? null;
          this.informe.set(ultimo);
          if (ultimo === null) {
            this.estado.set('sin-informe');
            return;
          }
          this.atender(ultimo);
        },
        error: () => this.estado.set('fallido'),
      }),
    );
  }

  /** Enruta según el estado de la fila: terminal se resuelve, `pending` se sigue. */
  private atender(informe: Report): void {
    if (informe.status === 'ready') {
      this.cargarContenido(informe);
      return;
    }
    if (informe.status === 'failed') {
      this.estado.set('fallido');
      return;
    }
    this.estado.set('generando');
    this.seguir(informe.id);
  }

  /**
   * Sondea hasta que el informe deje de moverse.
   *
   * El último valor que emite `poll` puede seguir siendo `pending`: es el caso
   * de un informe huérfano, que el ADR admite como riesgo aceptado (D4) cuando
   * el contenedor del agente reinicia a mitad. Ese caso sale por `fallido` y no
   * se queda girando, porque una pantalla que sondea para siempre es la misma
   * mentira que el spinner eterno que esto vino a arreglar.
   */
  private seguir(reportId: string): void {
    this.suscripciones.add(
      this.reportsService.poll(reportId).subscribe({
        next: (informe) => {
          this.informe.set(informe);
          if (!esTerminal(informe.status)) {
            return;
          }
          if (informe.status === 'ready') {
            this.cargarContenido(informe);
          } else {
            this.estado.set('fallido');
          }
        },
        error: () => this.estado.set('fallido'),
        complete: () => {
          // Se agoto el tope sin llegar a estado terminal.
          if (this.estado() === 'generando') {
            this.estado.set('fallido');
          }
        },
      }),
    );
  }

  private cargarContenido(informe: Report): void {
    this.suscripciones.add(
      this.reportsService.content(informe.id).subscribe({
        next: (contenido) => {
          this.contenido.set(contenido);
          this.estado.set('listo');
        },
        // Una fila `ready` cuyo contenido no se puede traer es un fallo de
        // verdad: el informe existe pero no hay forma de enseñarlo.
        error: () => this.estado.set('fallido'),
      }),
    );
  }

  /**
   * Descarga el PDF que renderizó el agente.
   *
   * Antes esto era `window.print()`, que imprime la PANTALLA: sale el menú del
   * navegador, la maquetación de la web y ninguna de las decisiones tipográficas
   * del informe. El PDF de verdad lo renderiza el agente con WeasyPrint y su
   * propia hoja de estilos (ADR-019 D11), y es el que el estudiante puede
   * enseñar en casa.
   *
   * Va por `Blob` + enlace temporal y no por `window.open`: la descarga necesita
   * la cabecera `Authorization`, y una pestaña nueva no la lleva.
   */
  exportPdf(): void {
    const informe = this.informe();
    if (informe?.status !== 'ready' || this.descargando()) {
      return;
    }

    this.descargando.set(true);
    this.suscripciones.add(
      this.reportsService.downloadPdf(informe.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `informe-de-orientacion-${informe.id}.pdf`;
          enlace.click();
          // Sin esto el blob se queda en memoria hasta que se recargue la
          // pagina; con varias descargas seguidas, uno por cada una.
          URL.revokeObjectURL(url);
          this.descargando.set(false);
        },
        error: () => this.descargando.set(false),
      }),
    );
  }

  /**
   * Porcentaje de admisión para pantalla.
   *
   * El dato ya viene en 0–100, así que aquí solo se redondea. Multiplicarlo
   * por cien —que es lo que se hacía, siguiendo un contrato que decía 0–1—
   * enseñaba el 17% de Ingeniería Geofísica como «1700%».
   */
  admisionEnPorcentaje(career: ReportContentCareer): number {
    return Math.round(career.admission_rate);
  }

  /** Si alguna cifra de esta ficha es la mediana de su familia y no un dato medido. */
  tieneEstimados(career: ReportContentCareer): boolean {
    return career.estimated.length > 0;
  }
}
