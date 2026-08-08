import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';

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
});