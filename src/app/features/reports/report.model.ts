/**
 * Los contratos REALES del informe de orientación (ADR-019).
 *
 * Sustituyen al contrato inventado que vivía en `features/careers/career.model.ts`,
 * cuya propia cabecera avisaba de que estaba escrito a partir de las tarjetas del
 * mockup y «debe confirmarse contra el Swagger real del backend». Nunca se
 * confirmó, y no coincidía en casi nada: ni en los nombres, ni en la forma, ni en
 * las unidades.
 *
 * **Son DOS contratos distintos y por eso están en dos interfaces.** No es una
 * separación cosmética: vienen de dos sitios diferentes, en dos formatos
 * diferentes, y confundirlos es justo lo que pasaba antes.
 *
 * - `Report` es la FILA del backend (`GET /v1/reports/{id}`). Es metadata y
 *   estado: quién, cuándo, en qué punto va, dónde quedaron los objetos en S3.
 *   Viaja en camelCase porque el backend lo emite así (Zod, `report.schema.ts`).
 *   **No trae el contenido del informe.**
 * - `ReportContent` es el DOCUMENTO (`GET /v1/reports/{id}/content`), el JSON que
 *   el agente subió a S3 y que el backend devuelve tal cual. Viaja en snake_case
 *   porque el agente lo serializa con `model_dump(mode="json")` sin alias
 *   (`08-deep-agent/src/models/report.py`).
 *
 * **Por qué se respeta el snake_case en vez de normalizarlo a camelCase.** El
 * backend es un proxy de bytes para este endpoint: sirve el fichero tal como salió
 * de S3, deliberadamente, para que el `checksumSha256` que guarda la fila siga
 * describiendo lo que el cliente recibe. Renombrar los campos aquí escribiría una
 * forma que ningún sistema emite, y la siguiente persona que compare esta interfaz
 * con el JSON de S3 encontraría dos verdades distintas — que es exactamente el
 * fallo que este fichero viene a cerrar.
 */

/** Estados de la fila. Los tres que emite el backend, ni uno más. */
export type ReportStatus = 'pending' | 'ready' | 'failed';

/**
 * Un objeto en S3, tal como lo publica el backend.
 *
 * Se publica la KEY, no una URL firmada: la descarga va por el endpoint del
 * backend con el JWT delante (ADR-019 D3). El frontend no habla con S3.
 */
export interface StoredObject {
  key: string;
  versionId: string | null;
  sizeBytes: number;
  checksumSha256: string;
}

export interface ReportObjects {
  json: StoredObject;
  pdf: StoredObject;
}

/**
 * La fila del informe.
 *
 * Casi cada campo es nullable a propósito: una fila en `pending` no sabe nada
 * de sí misma, y el backend prefiere decir `null` a inventar un valor por
 * defecto. Cualquier pantalla que lea esto tiene que contar con ello.
 */
export interface Report {
  id: string;
  status: ReportStatus;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
  objects: ReportObjects | null;
  schemaVersion: string | null;
  /** Código Holland de 3 letras. */
  riasecCode: string | null;
  /** 0–1. */
  profileCompleteness: number | null;
  topCareers: string[] | null;
  datasetSource: string | null;
  /** ISO 8601, solo fecha (`YYYY-MM-DD`). */
  datasetSnapshotDate: string | null;
  generationMs: number | null;
  /** Solo cuando `status === 'failed'`. */
  failureReason: string | null;
}

/** `GET /v1/reports` — el listado histórico. */
export interface ReportList {
  reports: Report[];
}

/**
 * Una carrera del documento.
 *
 * Los campos van PLANOS, no anidados bajo `metrics` como en el contrato viejo.
 * Y el modelo solo escribe uno de ellos, `insight`: el resto sale del motor de
 * afinidad y del catálogo del MINEDU (ADR-019 D6). Esa separación es la razón de
 * que el informe pueda enseñarse en casa para decidir dónde estudiar.
 */
export interface ReportContentCareer {
  career: string;
  career_family: string;
  riasec_profile: string;
  institution: string;
  /** 'Universidad' o 'Instituto'. */
  institution_type: string;
  /** 'Publica' o 'Privada'. */
  management_type: string;
  location: string;
  duration_years: number;
  /** Soles al mes. */
  monthly_income: number;
  /** Soles al año. */
  annual_cost: number;
  /**
   * **0–100.** Es el porcentaje ya hecho, no una fracción: la columna del
   * catálogo trae 60, 88, 33.
   *
   * El nombre dice «rate» y durante un tiempo los tres consumidores —este
   * modelo, el PDF y esta pantalla— documentaron 0–1 y multiplicaban por
   * cien, así que un 17% se enseñaba como 1700%. El dato nunca fue una
   * fracción; lo que estaba mal era el contrato.
   */
  admission_rate: number;
  /** 0–100. */
  match_score: number;
  score_breakdown: Record<string, number>;
  /**
   * Campos que NO son datos medidos de este programa sino la mediana de su
   * familia de carrera.
   *
   * Llega hasta la pantalla a propósito: sin esta lista, un ingreso imputado es
   * indistinguible de uno publicado por el MINEDU. Enseñarlo no es un detalle
   * técnico, es la diferencia entre informar y aparentar.
   */
  estimated: string[];
  /** Lo único que escribe el modelo de cada carrera. */
  insight: string;
}

/**
 * El documento del informe, tal como está guardado en S3.
 *
 * `schema_version` sube cuando un lector viejo dejaría de entender un informe
 * nuevo. Un informe se relee meses después, cuando el código que lo escribió ya
 * no existe; sin ese número habría que adivinar de qué época es.
 */
export interface ReportContent {
  schema_version: string;
  /** Prosa del modelo. */
  profile_summary: string;
  riasec_code: string;
  careers: ReportContentCareer[];
  total_candidates: number;
  careers_matched: number;
  filters_applied: string[];
  /** Cuántos programas quedarían soltando cada filtro. */
  candidates_without_each_filter: Record<string, number>;
  scoring_version: string;
  /** Sin fecha. Ej. 'Ponte en Carrera (MINEDU)'. */
  dataset_source: string;
  /** `YYYY-MM-DD`. */
  dataset_snapshot_date: string;
}

/** Estados terminales: un informe aquí ya no se mueve, y el polling para. */
export const ESTADOS_TERMINALES: readonly ReportStatus[] = ['ready', 'failed'];

export function esTerminal(estado: ReportStatus): boolean {
  return ESTADOS_TERMINALES.includes(estado);
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'setiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Cuándo se pidió un informe, para poder distinguirlo de los demás.
 *
 * A mano y no con `DatePipe`: el formato en español necesita
 * `registerLocaleData(localeEs)` en el arranque, y sin él Angular lanza en
 * tiempo de ejecución. Traer el paquete de locale entero —con sus reglas de
 * plurales y sus símbolos de moneda— para escribir «11 de agosto» es mucho
 * bulto para una línea. Además así es una función pura y se prueba sola.
 *
 * Setiembre con e, que es como se escribe en Perú.
 */
export function fechaDelInforme(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }
  const hora = String(fecha.getHours()).padStart(2, '0');
  const minuto = String(fecha.getMinutes()).padStart(2, '0');
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}, ${hora}:${minuto}`;
}

/**
 * Qué se lee de un informe en la lista del histórico.
 *
 * Las carreras y no el identificador: dos informes de la misma semana se
 * distinguen por lo que recomendaron, no por un UUID. `topCareers` puede venir
 * a `null` —una fila en `pending` no sabe nada de sí misma—, y en ese caso lo
 * que hay que decir es en qué punto va, no una lista vacía.
 */
export function resumenDelInforme(informe: Report): string {
  if (informe.status === 'pending') {
    return 'Generándose…';
  }
  if (informe.status === 'failed') {
    return 'No se pudo generar';
  }
  const carreras = informe.topCareers ?? [];
  if (carreras.length === 0) {
    return 'Sin carreras registradas';
  }
  if (carreras.length <= 2) {
    return carreras.join(' · ');
  }
  return `${carreras.slice(0, 2).join(' · ')} y ${carreras.length - 2} más`;
}

/**
 * La etiqueta de procedencia que se enseña en pantalla.
 *
 * Se compone de los DOS campos del informe en vez de leer un texto ya montado,
 * porque el backend guarda origen y fecha en columnas distintas (ADR-019 D3) y
 * la alternativa —sacarle la fecha a un texto libre con una expresión regular—
 * se rompe en silencio el día que cambie la redacción.
 */
export function etiquetaDeProcedencia(fuente: string | null, fecha: string | null): string {
  if (!fuente) {
    return '';
  }
  if (!fecha) {
    return fuente;
  }
  const [anio, mes, dia] = fecha.split('-');
  return `${fuente} · datos del ${dia}/${mes}/${anio}`;
}

/**
 * Cómo se llama cada cifra cuando hay que nombrarla en una frase.
 *
 * Las claves son los nombres de campo del informe, que es lo que viaja en
 * `estimated`. Son nombres NUESTROS, en inglés y con guiones bajos, y hasta
 * ahora se pintaban tal cual: la ficha decía «Estimado a partir de carreras
 * similares: monthly_income». Al estudiante eso no le dice qué cifra está
 * estimada — que es justo lo único que la frase existe para decir.
 *
 * La redacción es la misma que usa el PDF (`src/reports/cifras.py::FILAS` en
 * el agente), en minúscula porque aquí van dentro de una oración.
 */
const NOMBRE_DE_LA_CIFRA: Record<string, string> = {
  duration_years: 'la duración',
  monthly_income: 'el ingreso mensual al egresar',
  annual_cost: 'el costo anual',
  admission_rate: 'la tasa de admisión',
  match_score: 'la afinidad',
};

/**
 * Las cifras estimadas de una ficha, en castellano y enumeradas.
 *
 * Un campo que no esté en el mapa sale tal cual: es preferible enseñar un
 * nombre feo que callarse que una cifra está estimada. Si aparece uno nuevo,
 * se ve en pantalla y se añade aquí.
 */
export function cifrasEstimadas(estimated: readonly string[]): string {
  const nombres = estimated.map((campo) => NOMBRE_DE_LA_CIFRA[campo] ?? campo);
  if (nombres.length <= 1) {
    return nombres.join('');
  }
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}
