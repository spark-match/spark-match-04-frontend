import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../../spark-match-services/spark-match/src/environments/environment';
import { FeedbackValue, OrientationReport } from '../models/career.model';
import { OrientationFilters } from '../models/filters.model';

function buildMockReport(filters: OrientationFilters | null): OrientationReport {
  const budget = filters?.budget ?? 8000;
  const region = filters?.region || 'Lima Metropolitana';
  const institutionLabel =
    filters?.institutionType === 'privada'
      ? 'Privada'
      : filters?.institutionType === 'publica'
        ? 'Pública'
        : 'Pública/Privada';

  return {
    id: 'mock-report-1',
    profileSummary: `${region} · ${institutionLabel} · S/. ${budget.toLocaleString('es-PE')}/año · Generado hoy`,
    filters,
    generatedAt: new Date().toISOString(),
    careers: [
      {
        id: 'career-1',
        rank: 1,
        isTopMatch: true,
        title: 'Ingeniería de Sistemas e Informática',
        institution: 'Universidad Nacional Mayor de San Marcos',
        matchPct: 94,
        insight:
          'Mayor empleabilidad en el sector privado. Demanda creciente del 28% anual según MTPE.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 12,
          monthlyIncomeAvg: 4800,
          annualCostAvg: 1200,
        },
        source: 'Ponte en Carrera 2024',
        userFeedback: null,
      },
      {
        id: 'career-2',
        rank: 2,
        isTopMatch: false,
        title: 'Ingeniería Biomédica',
        institution: 'Universidad Nacional de Ingeniería',
        matchPct: 89,
        insight:
          'Carrera emergente. Crecimiento del 34% en oferta laboral en los últimos 3 años en Perú.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 8,
          monthlyIncomeAvg: 5200,
          annualCostAvg: 1400,
        },
        source: 'Ponte en Carrera 2024',
        userFeedback: null,
      },
      {
        id: 'career-3',
        rank: 3,
        isTopMatch: false,
        title: 'Ciencia de Datos',
        institution: 'Pontificia Universidad Católica del Perú',
        matchPct: 85,
        insight: 'Uno de los perfiles más demandados por empresas tecnológicas y fintech en Lima.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 15,
          monthlyIncomeAvg: 5000,
          annualCostAvg: 1300,
        },
        source: 'Ponte en Carrera 2024',
        userFeedback: null,
      },
    ],
  };
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reports`;

  getReport(filters: OrientationFilters | null, sessionId?: string): Observable<OrientationReport> {
    if (environment.useMocks) {
      return of(buildMockReport(filters)).pipe(delay(500));
    }
    const params = sessionId ? { sessionId } : undefined;
    return this.http.get<OrientationReport>(`${this.base}/latest`, { params });
  }

  submitFeedback(reportId: string, careerId: string, value: FeedbackValue): Observable<void> {
    if (environment.useMocks) {
      return of(void 0).pipe(delay(200));
    }
    return this.http.post<void>(`${this.base}/${reportId}/careers/${careerId}/feedback`, { value });
  }
}
