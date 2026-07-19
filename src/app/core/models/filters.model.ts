/**
 * Contrato INVENTADO a partir de lo que FiltersComponent necesita enviar.
 * Cuando el backend defina su Swagger/OpenAPI, ajusta solo este archivo:
 * los componentes ya consumen estos tipos a través de FiltersService.
 */

export type InstitutionType = 'publica' | 'privada' | 'ambas';
export type AcademicType = 'universidad' | 'instituto' | 'ambos';

export interface RegionOption {
  code: string;
  name: string;
}

/** Filtros que el usuario configura en /filters y que precargan el chat. */
export interface OrientationFilters {
  region: string;
  institutionType: InstitutionType;
  academicType: AcademicType;
  /** Presupuesto anual máximo, en soles (PEN). */
  budget: number;
}
