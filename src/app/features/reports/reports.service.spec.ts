import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ReportsService } from './reports.service';
import { environment } from '../../../environments/environment';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
  });

  describe('getReport (mocks enabled)', () => {
    it('returns a mock report with 3 careers', async () => {
      expect(environment.useMocks).toBe(true);

      const report = await firstValueFrom(service.getReport(null));

      expect(report.id).toBe('mock-report-1');
      expect(report.careers.length).toBe(3);
      expect(report.careers[0].isTopMatch).toBe(true);
      expect(report.generatedAt).toBeTruthy();
    });

    it('uses the supplied filters to build the profile summary', async () => {
      const report = await firstValueFrom(
        service.getReport({
          region: 'Arequipa',
          institutionType: 'privada',
          academicType: 'salud',
          budget: 12000,
        } as never),
      );

      expect(report.profileSummary).toContain('Arequipa');
      expect(report.profileSummary).toContain('Privada');
      expect(report.profileSummary).toMatch(/12[.,]000/);
    });

    it('falls back to defaults when filters are null', async () => {
      const report = await firstValueFrom(service.getReport(null));

      expect(report.profileSummary).toContain('Lima Metropolitana');
      expect(report.profileSummary).toContain('Pública/Privada');
    });
  });

  /*
   * Estas tres pruebas no comprueban comportamiento, comprueban HONESTIDAD, y por eso
   * fijan valores literales en vez de rangos.
   *
   * Hasta el 2026-08-08 esta pantalla mostraba tres carreras escritas a mano —una de ellas
   * con S/. 4.800 y 12% de admisión— rotuladas «Fuente: Ponte en Carrera 2024». Se comprobó
   * contra el dataset y dos de las tres no existían en él, mientras la tercera tenía otras
   * cifras. Un mock que inventa datos plausibles y los atribuye a un organismo público no se
   * nota al leer el código: parece dato real. Solo se detecta cruzándolo con la fuente.
   *
   * De ahí que los números vayan clavados: si alguien los cambia, la prueba falla y le
   * obliga a volver al CSV. Un rango o un `toBeGreaterThan` dejaría pasar exactamente el
   * problema que estas pruebas existen para impedir.
   */
  describe('las fichas de ejemplo se corresponden con filas reales del dataset', () => {
    /** Filas de `data/features.csv`, las tres con los cuatro flags de imputación en False. */
    const FILAS_VERIFICADAS = [
      {
        title: 'Ingeniería de Sistemas',
        institution: 'Universidad Nacional de Ingeniería',
        durationYears: 5,
        admissionRatePct: 13,
        monthlyIncomeAvg: 4900,
        annualCostAvg: 110,
      },
      {
        title: 'Ingeniería Mecatrónica',
        institution: 'Universidad Nacional de Ingeniería',
        durationYears: 5,
        admissionRatePct: 7,
        monthlyIncomeAvg: 4195,
        annualCostAvg: 110,
      },
      {
        title: 'Ingeniería Informática',
        institution: 'Universidad Nacional Federico Villarreal',
        durationYears: 5,
        admissionRatePct: 28,
        monthlyIncomeAvg: 3678,
        annualCostAvg: 156,
      },
    ];

    it('cada ficha lleva los valores exactos de su fila', async () => {
      const report = await firstValueFrom(service.getReport(null));

      report.careers.forEach((career, i) => {
        const fila = FILAS_VERIFICADAS[i];
        expect(career.title).toBe(fila.title);
        expect(career.institution).toBe(fila.institution);
        expect(career.metrics.durationYears).toBe(fila.durationYears);
        expect(career.metrics.admissionRatePct).toBe(fila.admissionRatePct);
        expect(career.metrics.monthlyIncomeAvg).toBe(fila.monthlyIncomeAvg);
        expect(career.metrics.annualCostAvg).toBe(fila.annualCostAvg);
      });
    });

    it('todas citan la misma fuente, con la fecha real del snapshot', async () => {
      const report = await firstValueFrom(service.getReport(null));

      for (const career of report.careers) {
        expect(career.source).toBe('Ponte en Carrera (MINEDU) · datos del 13/06/2026');
      }
    });

    it('ningún texto atribuye cifras a organismos que no son la fuente', async () => {
      // El MTPE nunca fue fuente de este proyecto: la única es Ponte en Carrera (MINEDU).
      // Aun así, dos fichas afirmaban «28% anual según MTPE» y «crecimiento del 34%».
      const report = await firstValueFrom(service.getReport(null));
      const textos = report.careers.map((c) => c.insight).join(' ');

      expect(textos).not.toMatch(/MTPE|INEI|SUNEDU|seg[úu]n el Ministerio/i);
    });
  });
});