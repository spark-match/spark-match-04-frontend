/**
 * Los 25 departamentos del Perú (24 más la Provincia Constitucional del Callao).
 *
 * ESTA ES LA ÚNICA FUENTE DE VERDAD. Había dos, y no coincidían: `FiltersService`
 * tenía las 25 y el formulario de registro tenía SEIS escritas a mano, con un TODO
 * pidiendo justamente esto. Como el campo de región es obligatorio en el alta, un
 * estudiante de Loreto, Puno o Piura —19 de los 25 departamentos— no podía
 * terminar de registrarse. No era un detalle cosmético: era la puerta cerrada.
 *
 * Peor aún, la lista corta ofrecía «Lima Metropolitana», que no existe en los
 * datos: el `features.csv` del pipeline dice «Lima». Quien se registrase desde
 * Lima quedaba con un valor que no casa con ninguna fila del dataset.
 *
 * Verificado contra `data/features.csv` de spark-match-05-data-pipeline el
 * 2026-08-08: las 25 entradas de aquí se corresponden una a una con los 25
 * valores distintos de la columna `location`.
 *
 * SOBRE «Madre de Dios»: el dataset lo escribe «Madre De Dios», con De mayúscula.
 * Aquí se mantiene la forma correcta en español porque esto es texto que lee una
 * persona. El cruce con los datos debe hacerse por `code`, nunca por `name`, y
 * por eso el código existe: los nombres son para mostrar, los códigos para unir.
 */

export interface PeruRegion {
  /** Identificador estable, en minúsculas y sin acentos. Es la clave de cruce. */
  code: string;
  /** Nombre para mostrar, correctamente acentuado. NO usar para cruzar datos. */
  name: string;
}

export const PERU_REGIONS: readonly PeruRegion[] = [
  { code: 'amazonas', name: 'Amazonas' },
  { code: 'ancash', name: 'Áncash' },
  { code: 'apurimac', name: 'Apurímac' },
  { code: 'arequipa', name: 'Arequipa' },
  { code: 'ayacucho', name: 'Ayacucho' },
  { code: 'cajamarca', name: 'Cajamarca' },
  { code: 'callao', name: 'Callao' },
  { code: 'cusco', name: 'Cusco' },
  { code: 'huancavelica', name: 'Huancavelica' },
  { code: 'huanuco', name: 'Huánuco' },
  { code: 'ica', name: 'Ica' },
  { code: 'junin', name: 'Junín' },
  { code: 'la-libertad', name: 'La Libertad' },
  { code: 'lambayeque', name: 'Lambayeque' },
  { code: 'lima', name: 'Lima' },
  { code: 'loreto', name: 'Loreto' },
  { code: 'madre-de-dios', name: 'Madre de Dios' },
  { code: 'moquegua', name: 'Moquegua' },
  { code: 'pasco', name: 'Pasco' },
  { code: 'piura', name: 'Piura' },
  { code: 'puno', name: 'Puno' },
  { code: 'san-martin', name: 'San Martín' },
  { code: 'tacna', name: 'Tacna' },
  { code: 'tumbes', name: 'Tumbes' },
  { code: 'ucayali', name: 'Ucayali' },
];

/** Nombres para mostrar, en el mismo orden. Para selects que solo manejan texto. */
export const PERU_REGION_NAMES: readonly string[] = PERU_REGIONS.map((r) => r.name);
