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
});