import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { OrientationReport } from '../careers/career.model';
import { OrientationFilters } from '../filters/filters.model';

/**
 * La fecha es la del snapshot que hay en disco (`snapshots/raw_20260613_021109.xlsx` en
 * spark-match-05-data-pipeline), no una fecha aproximada. Importa que sea exacta: el portal
 * del MINEDU devuelve HTTP 500 desde el 2026-07-12 y la etapa `ingest` del dvc.yaml esta
 * congelada, asi que este snapshot es, por ahora, el unico dato del producto y no se
 * refresca solo. Si algun dia vuelve a ingestarse, esta constante tiene que moverse con el.
 */
const SOURCE_LABEL = 'Ponte en Carrera (MINEDU) · datos del 13/06/2026';

/**
 * Las tres fichas son FILAS REALES del `features.csv` de spark-match-05-data-pipeline,
 * no valores escritos a mano. Antes lo eran: hasta el 2026-08-08 esta funcion devolvia
 * Ingenieria de Sistemas/UNMSM con S/. 4.800 y 12% de admision, Ingenieria Biomedica/UNI
 * y Ciencia de Datos/PUCP, todas rotuladas "Fuente: Ponte en Carrera 2024". Se comprobo
 * contra el dataset: de las tres, DOS no existian en el (0 filas) y la tercera tenia otras
 * cifras (S/. 4.582 y 5% de admision). O sea que se atribuian al MINEDU numeros que el
 * MINEDU nunca publico.
 *
 * Criterio de eleccion de las de ahora: las tres tienen los cuatro flags de imputacion en
 * False, es decir duracion, ingreso, costo y tasa de admision son valores medidos, no
 * estimados por el pipeline. Solo 370 de las 6.208 filas cumplen eso, y 129 estan en Lima.
 * Se descarto Ingenieria de Sistemas/UNMSM justamente por eso: su costo anual esta imputado.
 *
 * Lo que SIGUE sin respaldo es `matchPct`. La afinidad es la salida del motor de scoring
 * multicriterio, que todavia no existe conectado en ningun repositorio, asi que ese numero
 * es ilustrativo y el orden del Top-3 tambien. Se sustituye cuando exista el motor; hasta
 * entonces el resto de la tarjeta si es verificable contra el dataset.
 *
 * El costo anual de tres cifras no es un error: son universidades publicas y el dataset
 * recoge la tasa administrativa, no una matricula privada.
 */
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
        title: 'Ingeniería de Sistemas',
        institution: 'Universidad Nacional de Ingeniería',
        matchPct: 94,
        insight:
          'Ingreso mensual más alto de las tres opciones. Admisión del 13%, así que es selectiva.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 13,
          monthlyIncomeAvg: 4900,
          annualCostAvg: 110,
        },
        source: SOURCE_LABEL,
      },
      {
        id: 'career-2',
        rank: 2,
        isTopMatch: false,
        title: 'Ingeniería Mecatrónica',
        institution: 'Universidad Nacional de Ingeniería',
        matchPct: 89,
        insight:
          'La más selectiva de las tres: solo entra el 7% de quienes postulan. Mismo costo anual.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 7,
          monthlyIncomeAvg: 4195,
          annualCostAvg: 110,
        },
        source: SOURCE_LABEL,
      },
      {
        id: 'career-3',
        rank: 3,
        isTopMatch: false,
        title: 'Ingeniería Informática',
        institution: 'Universidad Nacional Federico Villarreal',
        matchPct: 85,
        insight: 'La más accesible del grupo, con un 28% de admisión, a cambio de menor ingreso.',
        metrics: {
          durationYears: 5,
          admissionRatePct: 28,
          monthlyIncomeAvg: 3678,
          annualCostAvg: 156,
        },
        source: SOURCE_LABEL,
      },
    ],
  };
}

@Service()
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

}
