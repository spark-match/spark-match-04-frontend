import { Service, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AcademicType, InstitutionType, OrientationFilters, RegionOption } from './filters.model';
import { PERU_REGIONS } from '../../shared/data/peru-regions';

/**
 * Forma de las preferencias en el perfil del agente
 * (`StudentProfile` en spark-match-07-deep-agent).
 *
 * Los nombres son los de las columnas del dataset, no los de esta pantalla, y
 * el cruce va INVERTIDO respecto a lo que sugiere el nombre local:
 *
 *     institutionType (pública/privada)      -> preferred_management
 *     academicType    (universidad/instituto) -> preferred_institution_type
 *
 * La traducción vive aquí, en el borde, y en ningún otro sitio.
 */
export interface ProfilePreferences {
  preferred_region: string | null;
  preferred_management: string | null;
  preferred_institution_type: string | null;
  max_annual_budget: number | null;
}

interface ProfileResponse {
  profile: (Partial<ProfilePreferences> & Record<string, unknown>) | null;
}

/** Sin acentos y en minúsculas, que es como comparan los dos lados.
 *
 * El agente guarda «pública» con tilde y esta pantalla usa «publica» sin ella. El rango
 * \u0300-\u036f son las marcas diacriticas que `NFD` separa de su letra, y se escribe
 * escapado para que no dependa de como se guarde este fichero.
 */
function plano(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function aInstitutionType(valor: string | null | undefined): InstitutionType {
  const v = plano(valor);
  if (v === 'publica') return 'publica';
  if (v === 'privada') return 'privada';
  // Nulo o desconocido: «me da igual». No es lo mismo que no saberlo, pero en
  // esta pantalla ambos se muestran igual y el agente trata los dos como
  // «no filtres».
  return 'ambas';
}

function aAcademicType(valor: string | null | undefined): AcademicType {
  const v = plano(valor);
  if (v === 'universidad') return 'universidad';
  if (v === 'instituto') return 'instituto';
  return 'ambos';
}

/**
 * Perfil del agente -> filtros de esta pantalla.
 *
 * Exportada para poder probarla sola: es donde vive el cruce invertido y
 * equivocarse ahí no rompe nada visible — el agente filtraría por la columna
 * equivocada y el estudiante recibiría recomendaciones que no encajan con lo
 * que pidió, sin ningún error por ninguna parte.
 */
export function profileToFilters(
  perfil: Partial<ProfilePreferences> | null | undefined,
): OrientationFilters | null {
  if (!perfil) return null;
  return {
    region: perfil.preferred_region ?? '',
    institutionType: aInstitutionType(perfil.preferred_management),
    academicType: aAcademicType(perfil.preferred_institution_type),
    budget: perfil.max_annual_budget ?? null,
  };
}

/**
 * Filtros de esta pantalla -> perfil del agente.
 *
 * `'ambas'`, `'ambos'` y la región vacía viajan como `null`, que es lo que el
 * agente entiende por «no filtres por esto». Mandar la cadena «ambas» filtraría
 * por una gestión que no existe y dejaría al estudiante sin ningún resultado.
 */
export function filtersToProfilePayload(filters: OrientationFilters): ProfilePreferences {
  return {
    preferred_region: filters.region || null,
    preferred_management: filters.institutionType === 'ambas' ? null : filters.institutionType,
    preferred_institution_type: filters.academicType === 'ambos' ? null : filters.academicType,
    max_annual_budget: filters.budget,
  };
}

@Service()
export class FiltersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.agentUrl}/profile`;

  private readonly _currentFilters = signal<OrientationFilters | null>(null);
  readonly currentFilters = this._currentFilters.asReadonly();
  readonly hasFilters = computed(() => this._currentFilters() !== null);

  /**
   * Los 25 departamentos del Perú. Constantes, síncronos, sin red.
   *
   * Hasta el 2026-08-09 esto hacía `GET {apiUrl}/catalog/regions` cuando
   * `useMocks` iba en false, y ese endpoint no existe: el backend solo tiene el
   * contexto `identity`. En los entornos desplegados la llamada daba 404, el
   * componente no tenía rama de error y el desplegable se quedaba en «Cargando
   * regiones...» para siempre. Como la región era obligatoria en el formulario,
   * el botón «Iniciar chat de orientación» no se habilitaba nunca: no era un
   * spinner cosmético, era el producto entero bloqueado en su primera pantalla.
   *
   * Y el arreglo no es añadir un `catch`, es no llamar. Los departamentos del
   * Perú son 25 y no cambian; la lista ya viaja compilada en el bundle
   * (`shared/data/peru-regions`, verificada una a una contra la columna
   * `location` del dataset) y pedirle a un servidor una constante que ya
   * tenemos solo añade un modo de fallo. Devolverla de forma síncrona hace que
   * el estado «cargando» no pueda existir.
   */
  getRegions(): readonly RegionOption[] {
    return PERU_REGIONS;
  }

  /**
   * Lee del perfil del agente lo que ya sabe de este estudiante.
   *
   * Devuelve `null` cuando no hay nada guardado todavía o cuando la llamada
   * falla, y esa equivalencia es intencionada: esta pantalla dejó de ser
   * obligatoria, así que un fallo al cargar preferencias no puede impedir
   * usarla. Se arranca con los valores vacíos y ya está.
   */
  loadPreferences(): Observable<OrientationFilters | null> {
    if (environment.useMocks) {
      return of(this._currentFilters());
    }

    return this.http.get<ProfileResponse>(this.base).pipe(
      map((response) => profileToFilters(response.profile)),
      tap((filtros) => {
        if (filtros) this._currentFilters.set(filtros);
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * Guarda las cuatro preferencias en el perfil del agente.
   *
   * El estado local se actualiza SIEMPRE, falle o no la petición: la pantalla
   * ya navega al chat y lo peor que puede pasar es que la próxima sesión no
   * recuerde lo que se eligió. Bloquear el paso al chat por un fallo de red
   * sería repetir el mismo error que tenía esta pantalla.
   *
   * `'ambas'`/`'ambos'` y la región vacía se mandan como `null`, que es lo que
   * el agente entiende por «no filtres por esto».
   */
  savePreferences(filters: OrientationFilters): Observable<boolean> {
    this._currentFilters.set(filters);

    if (environment.useMocks) {
      return of(true);
    }

    return this.http
      .put<ProfileResponse>(`${this.base}/preferences`, filtersToProfilePayload(filters))
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  setFilters(filters: OrientationFilters): void {
    this._currentFilters.set(filters);
  }

  clearFilters(): void {
    this._currentFilters.set(null);
  }
}
