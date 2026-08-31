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

/**
 * Preferencias de búsqueda del estudiante. Ninguna es obligatoria.
 *
 * Desde el 2026-08-09 estas cuatro forman parte del perfil que el agente
 * mantiene por conversación (`StudentProfile` en spark-match-07-deep-agent),
 * igual que el código RIASEC. Esta pantalla dejó de ser una puerta y pasó a
 * ser una vista editable de lo mismo: quien prefiera contarlo hablando puede
 * ir directo al chat.
 *
 * `region` vacía y `budget` nulo significan **«no lo sabemos»**, no «sin
 * filtro». La diferencia importa porque el agente los convierte en exclusiones
 * y un valor inventado no da una respuesta mala: borra opciones en silencio.
 * `institutionType` y `academicType` sí tienen un valor para «me da igual»
 * ('ambas' / 'ambos'), así que no necesitan nulo.
 */
export interface OrientationFilters {
  region: string;
  institutionType: InstitutionType;
  academicType: AcademicType;
  /** Presupuesto anual máximo en soles (PEN); `null` si no lo ha dicho. */
  budget: number | null;
}
