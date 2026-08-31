import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import {
  FiltersService,
  filtersToProfilePayload,
  profileToFilters,
} from './filters.service';
import { OrientationFilters } from './filters.model';

/**
 * El mapeo entre esta pantalla y el perfil del agente va CRUZADO, y es la
 * única razón de peso para que estas pruebas existan:
 *
 *     institutionType (pública/privada)       -> preferred_management
 *     academicType    (universidad/instituto) -> preferred_institution_type
 *
 * Los nombres locales invitan a emparejar `institutionType` con
 * `preferred_institution_type`, que es justo lo contrario de lo correcto. Un
 * cruce mal hecho no rompe nada visible: el agente filtra por la columna
 * equivocada y el estudiante recibe recomendaciones que no encajan con lo que
 * pidió, sin ningún error por ninguna parte.
 *
 * Se prueban las funciones puras y no las llamadas HTTP porque el sistema de
 * tests de Angular no admite `vi.mock` sobre imports relativos, así que no hay
 * forma de poner `useMocks` en false desde aquí. La ganancia es que la lógica
 * de riesgo queda cubierta sin tocar red ni entorno.
 */
describe('Mapeo entre la pantalla y el perfil del agente', () => {
  const filtros = (overrides: Partial<OrientationFilters> = {}): OrientationFilters => ({
    region: 'Arequipa',
    institutionType: 'publica',
    academicType: 'universidad',
    budget: 8000,
    ...overrides,
  });

  describe('profileToFilters', () => {
    it('deshace el cruce al leer del perfil', () => {
      const resultado = profileToFilters({
        preferred_region: 'Cusco',
        preferred_management: 'privada',
        preferred_institution_type: 'instituto',
        max_annual_budget: 4500,
      });

      expect(resultado).toEqual({
        region: 'Cusco',
        // Sale de `preferred_management`, NO de `preferred_institution_type`.
        institutionType: 'privada',
        academicType: 'instituto',
        budget: 4500,
      });
    });

    it('acepta el acento con el que lo guarda el agente', () => {
      // El agente escribe «pública»; esta pantalla trabaja sin tilde.
      expect(profileToFilters({ preferred_management: 'Pública' })?.institutionType).toBe(
        'publica',
      );
    });

    it('un campo sin definir se muestra como «me da igual»', () => {
      expect(profileToFilters({ preferred_region: null, preferred_management: null })).toEqual({
        region: '',
        institutionType: 'ambas',
        academicType: 'ambos',
        budget: null,
      });
    });

    it('un valor que no reconoce no se cuela como filtro', () => {
      expect(profileToFilters({ preferred_management: 'mixta' })?.institutionType).toBe('ambas');
    });

    it('sin perfil devuelve null', () => {
      expect(profileToFilters(null)).toBeNull();
      expect(profileToFilters(undefined)).toBeNull();
    });
  });

  describe('filtersToProfilePayload', () => {
    it('manda el cruce correcto al perfil', () => {
      expect(filtersToProfilePayload(filtros())).toEqual({
        preferred_region: 'Arequipa',
        preferred_management: 'publica',
        preferred_institution_type: 'universidad',
        max_annual_budget: 8000,
      });
    });

    it('«ambas», «ambos» y la región vacía viajan como null', () => {
      // `null` es lo que el agente entiende por «no filtres por esto». Mandar
      // la cadena «ambas» filtraría por una gestión que no existe y dejaría al
      // estudiante sin ningún resultado.
      expect(
        filtersToProfilePayload(
          filtros({ region: '', institutionType: 'ambas', academicType: 'ambos', budget: null }),
        ),
      ).toEqual({
        preferred_region: null,
        preferred_management: null,
        preferred_institution_type: null,
        max_annual_budget: null,
      });
    });

    it('ida y vuelta conserva lo que el estudiante eligió', () => {
      const original = filtros({ region: 'Puno', institutionType: 'privada', budget: 12000 });

      expect(profileToFilters(filtersToProfilePayload(original))).toEqual(original);
    });

    it('un presupuesto de cero no se confunde con «sin presupuesto»', () => {
      // `0` es una respuesta legítima —solo gratuito o público— y `|| null`
      // sobre un número la habría convertido en «no lo sé».
      expect(filtersToProfilePayload(filtros({ budget: 0 })).max_annual_budget).toBe(0);
    });
  });
});

describe('FiltersService', () => {
  let service: FiltersService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [FiltersService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FiltersService);
  });

  it('devuelve las 25 regiones sin tocar la red', () => {
    expect(service.getRegions().length).toBe(25);
  });

  it('guarda el estado local antes de salir a la red', () => {
    // Con `useMocks` en true (el entorno local) no hay petición, pero el
    // estado sí tiene que quedar puesto: es lo que lee ChatComponent para la
    // cabecera y ReportsComponent para pedir el informe.
    service.savePreferences({
      region: 'Tacna',
      institutionType: 'publica',
      academicType: 'ambos',
      budget: null,
    });

    expect(service.currentFilters()?.region).toBe('Tacna');
    expect(service.hasFilters()).toBe(true);
  });

  it('clearFilters lo deja vacío', () => {
    service.setFilters({
      region: 'Ica',
      institutionType: 'ambas',
      academicType: 'ambos',
      budget: null,
    });
    service.clearFilters();

    expect(service.currentFilters()).toBeNull();
    expect(service.hasFilters()).toBe(false);
  });
});
