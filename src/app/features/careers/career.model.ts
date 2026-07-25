/**
 * Contrato INVENTADO a partir de las tarjetas de ReportsComponent (mockup "Reporte
 * de Orientación"). Los nombres de campos siguen lo que Ponte en Carrera (MINEDU)
 * suele exponer, pero deben confirmarse contra el Swagger real del backend.
 */
import { OrientationFilters } from '../filters/filters.model';

export interface CareerMetrics {
  durationYears: number;
  admissionRatePct: number;
  /** Ingreso mensual promedio, en soles (PEN). */
  monthlyIncomeAvg: number;
  /** Costo anual promedio, en soles (PEN). */
  annualCostAvg: number;
}

export interface CareerMatch {
  id: string;
  rank: number;
  title: string;
  institution: string;
  matchPct: number;
  isTopMatch: boolean;
  insight: string;
  metrics: CareerMetrics;
  /** Ej. "Ponte en Carrera 2024" */
  source: string;
}

export interface OrientationReport {
  id: string;
  profileSummary: string;
  filters: OrientationFilters | null;
  /** ISO 8601 */
  generatedAt: string;
  careers: CareerMatch[];
}
