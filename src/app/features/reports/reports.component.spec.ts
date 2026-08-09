import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ReportsComponent } from './reports.component';
import { ReportsService } from './reports.service';
import { FiltersService } from '../filters/filters.service';
import { OrientationReport } from '../careers/career.model';

const buildReport = (overrides: Partial<OrientationReport> = {}): OrientationReport => ({
  id: 'r1',
  profileSummary: 'Lima Metropolitana · Pública · S/. 8.000/año · Generado hoy',
  filters: null,
  generatedAt: new Date().toISOString(),
  careers: [
    {
      id: 'c1',
      rank: 1,
      isTopMatch: true,
      title: 'Ingeniería de Sistemas',
      institution: 'UNMSM',
      matchPct: 94,
      insight: 'Demanda creciente',
      metrics: { durationYears: 5, admissionRatePct: 12, monthlyIncomeAvg: 4800, annualCostAvg: 1200 },
      source: 'Ponte en Carrera 2024',
    },
    {
      id: 'c2',
      rank: 2,
      isTopMatch: false,
      title: 'Ingeniería Biomédica',
      institution: 'UNI',
      matchPct: 89,
      insight: 'Carrera emergente',
      metrics: { durationYears: 5, admissionRatePct: 8, monthlyIncomeAvg: 5200, annualCostAvg: 1400 },
      source: 'Ponte en Carrera 2024',
    },
  ],
  ...overrides,
});

describe('ReportsComponent', () => {
  let component: ReportsComponent;
  let fixture: ComponentFixture<ReportsComponent>;
  let getReportMock: ReturnType<typeof vi.fn>;
  let printSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    getReportMock = vi.fn().mockReturnValue(of(buildReport())) as unknown as ReturnType<typeof vi.fn>;
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        { provide: ReportsService, useValue: { getReport: getReportMock } },
        { provide: FiltersService, useValue: { currentFilters: signal(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    printSpy.mockRestore();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('fetches the report from the service on init', () => {
    expect(getReportMock).toHaveBeenCalledOnce();
  });

  it('exposes the careers array from the report', () => {
    expect(component.careers.length).toBe(2);
    expect(component.careers[0].isTopMatch).toBe(true);
  });

  it('exposes careersFound as the count of careers', () => {
    expect(component.careersFound).toBe(2);
  });

  it('exposes the profile summary string', () => {
    expect(component.profile).toContain('Lima Metropolitana');
    expect(component.profile).toContain('8.000');
  });

  it('clears the loading flag once the report is in', () => {
    expect(component.loading()).toBe(false);
  });

  it('renders the careers list in the template', () => {
    const html = fixture.nativeElement as HTMLElement;
    const cards = html.querySelectorAll('.report__card');
    expect(cards.length).toBe(2);
    expect(html.textContent).toContain('Ingeniería de Sistemas');
    expect(html.textContent).toContain('Ingeniería Biomédica');
  });

  it('shows the loading message while the report is pending', () => {
    component.loading.set(true);
    component.report.set(null);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Generando tu reporte');
  });

  it('returns empty arrays and counts when no report is set', () => {
    component.report.set(null);
    expect(component.careers).toEqual([]);
    expect(component.careersFound).toBe(0);
    expect(component.profile).toBe('');
  });

  it('triggers window.print when exportPdf is called', () => {
    component.exportPdf();
    expect(printSpy).toHaveBeenCalledOnce();
  });

  /*
   * El banner citaba la fuente escrita a mano en la plantilla: «Datos: Ponte en Carrera 2024».
   * Cuando el 2026-08-08 se corrigió la atribución de las fichas, el banner no se enteró y la
   * pantalla quedó diciendo dos fechas distintas a la vez. Se detectó descargando el bundle
   * desplegado y buscando la cadena vieja, no leyendo el código.
   *
   * Estas pruebas fijan que la fuente del banner SALE DEL DATO. Por eso el fixture usa un
   * valor deliberadamente inventado: si alguien vuelve a escribirla en la plantilla, el
   * texto no coincidirá y la prueba caerá.
   */
  describe('la fuente del banner sale del dato, no de la plantilla', () => {
    it('muestra en el banner la fuente que trae el reporte', () => {
      const informe = buildReport();
      informe.careers.forEach((c) => (c.source = 'FUENTE-DE-PRUEBA-XYZ'));
      getReportMock.mockReturnValue(of(informe));

      fixture = TestBed.createComponent(ReportsComponent);
      fixture.detectChanges();

      const banner = (fixture.nativeElement as HTMLElement).querySelector('.report__banner');
      expect(banner?.textContent).toContain('FUENTE-DE-PRUEBA-XYZ');
    });

    it('no lleva ninguna fuente escrita a mano en la plantilla', () => {
      const informe = buildReport();
      informe.careers.forEach((c) => (c.source = 'FUENTE-DE-PRUEBA-XYZ'));
      getReportMock.mockReturnValue(of(informe));

      fixture = TestBed.createComponent(ReportsComponent);
      fixture.detectChanges();

      const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(html).not.toContain('Ponte en Carrera 2024');
    });

    it('no rompe el banner cuando el reporte viene vacío', () => {
      component.report.set(null);
      fixture.detectChanges();

      expect(component.dataSource).toBe('');
    });
  });

  /*
   * Hasta el 2026-08-09 la suscripción de `ngOnInit` solo tenía callback de éxito, así que
   * cualquier fallo dejaba `loading` en true para siempre: la pantalla se quedaba en
   * «Generando tu reporte de orientación...» sin mensaje, sin reintento y sin forma de
   * saber que algo había ido mal.
   *
   * No era el caso raro, era el normal. En los entornos desplegados `useMocks` va en false
   * y `GET /reports/latest` todavía no existe en el backend, así que la petición terminaba
   * siempre en 404 y el spinner no se iba nunca.
   */
  describe('cuando la petición falla', () => {
    const montarConFallo = (): HTMLElement => {
      getReportMock.mockReturnValue(throwError(() => new Error('404')));

      fixture = TestBed.createComponent(ReportsComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      return fixture.nativeElement as HTMLElement;
    };

    it('sale del estado de carga en vez de quedarse colgado', () => {
      montarConFallo();

      expect(component.loading()).toBe(false);
      expect(component.failed()).toBe(true);
    });

    it('deja de mostrar el mensaje de "Generando tu reporte"', () => {
      const html = montarConFallo();

      expect(html.textContent).not.toContain('Generando tu reporte');
    });

    it('muestra un aviso accesible con un botón de reintentar', () => {
      const html = montarConFallo();

      const aviso = html.querySelector('.report__error');
      expect(aviso).not.toBeNull();
      expect(aviso?.getAttribute('role')).toBe('alert');
      expect(html.querySelector('.report__retry')).not.toBeNull();
    });

    it('no deja a la vista un informe anterior junto al aviso de fallo', () => {
      const html = montarConFallo();

      expect(component.report()).toBeNull();
      expect(html.querySelectorAll('.report__card').length).toBe(0);
    });

    it('deshabilita el botón de exportar mientras no hay informe', () => {
      const html = montarConFallo();

      expect((html.querySelector('.report__export') as HTMLButtonElement).disabled).toBe(true);
    });

    it('se recupera al pulsar reintentar', () => {
      const html = montarConFallo();
      getReportMock.mockReturnValue(of(buildReport()));

      (html.querySelector('.report__retry') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component.failed()).toBe(false);
      expect(component.careersFound).toBe(2);
      expect(html.querySelectorAll('.report__card').length).toBe(2);
      expect((html.querySelector('.report__export') as HTMLButtonElement).disabled).toBe(false);
    });
  });
});