import { PERU_REGIONS, PERU_REGION_NAMES } from './peru-regions';

/*
 * El catálogo estaba duplicado: `FiltersService` tenía las 25 y el formulario de
 * registro seis escritas a mano. Como la región es obligatoria para completar el
 * alta, 19 de los 25 departamentos no podían registrarse.
 *
 * Estas pruebas fijan la lista COMPLETA en lugar de comprobar solo la longitud.
 * Un `toHaveLength(25)` pasaría igual si alguien sustituye Loreto por Lima otra
 * vez, y la lista corta también «tenía las regiones que hacían falta» según
 * quien la escribió.
 */

/** Los 25 valores distintos de `location` en data/features.csv (2026-08-08). */
const LOS_25_DEPARTAMENTOS = [
  'Amazonas',
  'Áncash',
  'Apurímac',
  'Arequipa',
  'Ayacucho',
  'Cajamarca',
  'Callao',
  'Cusco',
  'Huancavelica',
  'Huánuco',
  'Ica',
  'Junín',
  'La Libertad',
  'Lambayeque',
  'Lima',
  'Loreto',
  'Madre de Dios',
  'Moquegua',
  'Pasco',
  'Piura',
  'Puno',
  'San Martín',
  'Tacna',
  'Tumbes',
  'Ucayali',
];

describe('catálogo de regiones del Perú', () => {
  it('contiene exactamente los 25 departamentos, ni uno más ni uno menos', () => {
    expect([...PERU_REGION_NAMES]).toEqual(LOS_25_DEPARTAMENTOS);
  });

  it('no ofrece "Lima Metropolitana", que no existe en el dataset', () => {
    // La lista corta del registro la ofrecía. El dataset dice "Lima", así que
    // quien se registraba desde Lima quedaba con un valor que no casa con
    // ninguna fila.
    expect(PERU_REGION_NAMES).not.toContain('Lima Metropolitana');
    expect(PERU_REGION_NAMES).toContain('Lima');
  });

  it('incluye los departamentos que la lista corta dejaba fuera', () => {
    for (const region of ['Loreto', 'Puno', 'Ucayali', 'Madre de Dios', 'Tacna']) {
      expect(PERU_REGION_NAMES).toContain(region);
    }
  });

  it('tiene códigos únicos, en minúsculas y sin acentos', () => {
    const codes = PERU_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z-]+$/);
    }
  });

  it('mantiene nombres y códigos alineados uno a uno', () => {
    expect(PERU_REGION_NAMES.length).toBe(PERU_REGIONS.length);
    PERU_REGIONS.forEach((region, i) => {
      expect(PERU_REGION_NAMES[i]).toBe(region.name);
    });
  });
});
