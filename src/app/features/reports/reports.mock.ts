/**
 * El informe de ejemplo de local (`useMocks: true`).
 *
 * **Las tres fichas son FILAS REALES del `features.csv` de
 * spark-match-05-data-pipeline, y eso no es un detalle de fidelidad: es la
 * corrección de un fallo que ya ocurrió.**
 *
 * Hasta el 2026-08-08 esta pantalla mostraba tres carreras escritas a mano
 * —una con S/. 4.800 y 12% de admisión— rotuladas «Fuente: Ponte en Carrera
 * 2024». Se comprobó contra el dataset: de las tres, DOS no existían en él (0
 * filas) y la tercera tenía otras cifras (S/. 4.582 y 5% de admisión). O sea
 * que se le atribuían al MINEDU números que el MINEDU nunca publicó. Un mock
 * que inventa datos plausibles y los firma con un organismo público no se nota
 * leyendo el código: parece dato real.
 *
 * Criterio de elección de las de ahora: las tres tienen los cuatro flags de
 * imputación en `False`, es decir duración, ingreso, costo y tasa de admisión
 * son valores medidos y no estimados por el pipeline. Solo 370 de las 6.208
 * filas cumplen eso, y 129 están en Lima. Se descartó Ingeniería de
 * Sistemas/UNMSM justamente por eso: su costo anual está imputado.
 *
 * Lo que sigue SIN respaldo es `match_score`: la afinidad sale del motor de
 * scoring multicriterio, que en local no corre. Ese número es ilustrativo y el
 * orden del Top-3 también. El resto de la tarjeta sí es verificable contra el
 * dataset, y `reports.service.spec.ts` clava los valores para que siga
 * siéndolo.
 *
 * El costo anual de tres cifras no es un error: son universidades públicas y el
 * dataset recoge la tasa administrativa, no una matrícula privada.
 */
import { Report, ReportContent } from './report.model';

/**
 * La fecha del snapshot que hay en disco
 * (`snapshots/raw_20260613_021109.xlsx` en spark-match-05-data-pipeline), no
 * una fecha aproximada.
 *
 * Importa que sea exacta: el portal del MINEDU devuelve HTTP 500 desde el
 * 2026-07-12 y la etapa `ingest` del `dvc.yaml` está congelada, así que este
 * snapshot es por ahora el único dato del producto y no se refresca solo. Si
 * algún día vuelve a ingestarse, esta constante tiene que moverse con él.
 */
const FECHA_DEL_SNAPSHOT = '2026-06-13';
const FUENTE = 'Ponte en Carrera (MINEDU)';

export function informeDeEjemplo(overrides: Partial<Report> = {}): Report {
  const ahora = new Date().toISOString();
  return {
    id: 'mock-report-1',
    status: 'ready',
    createdAt: ahora,
    updatedAt: ahora,
    objects: {
      json: {
        key: 'reports/mock-user/mock-report-1.json',
        versionId: null,
        sizeBytes: 4096,
        checksumSha256: 'mock',
      },
      pdf: {
        key: 'reports/mock-user/mock-report-1.pdf',
        versionId: null,
        sizeBytes: 81920,
        checksumSha256: 'mock',
      },
    },
    schemaVersion: '1',
    riasecCode: 'RIA',
    profileCompleteness: 0.8,
    topCareers: ['Ingeniería de Sistemas', 'Ingeniería Mecatrónica', 'Ingeniería Informática'],
    datasetSource: FUENTE,
    datasetSnapshotDate: FECHA_DEL_SNAPSHOT,
    generationMs: 14200,
    failureReason: null,
    ...overrides,
  };
}

/**
 * El histórico de local: tres informes, no uno.
 *
 * Con una sola fila, la lista del histórico no se pinta —sólo aparece a partir
 * de dos— y la pantalla se veía en `ng serve` exactamente igual que antes de
 * que existiera. O sea que la única forma de comprobar la función era
 * desplegarla.
 *
 * Los tres días de separación son para que las fechas se distingan de un
 * vistazo. El tercero va `failed` a propósito: es el estado que la lista tiene
 * que saber enseñar sin romperse, y el que nadie recuerda probar.
 *
 * **El contenido que devuelve `content()` es el mismo para los tres.** No es un
 * descuido: el mock no simula tres documentos distintos, y fingirlo daría una
 * confianza que no corresponde. Aquí se comprueba la navegación entre informes,
 * no que cada uno traiga lo suyo.
 */
export function historicoDeEjemplo(): Report[] {
  const dias = (cuantos: number) =>
    new Date(Date.now() - cuantos * 24 * 60 * 60 * 1000).toISOString();

  return [
    informeDeEjemplo(),
    informeDeEjemplo({
      id: 'mock-report-2',
      createdAt: dias(3),
      updatedAt: dias(3),
      riasecCode: 'RIC',
      topCareers: ['Ingeniería Civil', 'Arquitectura'],
    }),
    informeDeEjemplo({
      id: 'mock-report-3',
      status: 'failed',
      createdAt: dias(9),
      updatedAt: dias(9),
      objects: null,
      topCareers: null,
      failureReason: 'Tu perfil aún no tenía las seis puntuaciones del cuestionario.',
    }),
  ];
}

export function contenidoDeEjemplo(): ReportContent {
  return {
    schema_version: '1',
    profile_summary:
      'Perfil realista e investigador, con interés marcado por resolver problemas ' +
      'técnicos concretos. Las tres opciones comparten esa base y se diferencian ' +
      'principalmente en cuán selectivo es el ingreso.',
    riasec_code: 'RIA',
    careers: [
      {
        career: 'Ingeniería de Sistemas',
        career_family: 'Ingeniería',
        riasec_profile: 'RIA',
        institution: 'Universidad Nacional de Ingeniería',
        institution_type: 'Universidad',
        management_type: 'Publica',
        location: 'Lima',
        duration_years: 5,
        monthly_income: 4900,
        annual_cost: 110,
        admission_rate: 13,
        match_score: 94,
        score_breakdown: { riasec: 38, ingreso: 30, costo: 16, admision: 10 },
        estimated: [],
        insight:
          'El ingreso mensual más alto de las tres opciones. La admisión del 13% la ' +
          'hace selectiva, así que conviene prepararse con tiempo.',
      },
      {
        career: 'Ingeniería Mecatrónica',
        career_family: 'Ingeniería',
        riasec_profile: 'RIA',
        institution: 'Universidad Nacional de Ingeniería',
        institution_type: 'Universidad',
        management_type: 'Publica',
        location: 'Lima',
        duration_years: 5,
        monthly_income: 4195,
        annual_cost: 110,
        admission_rate: 7,
        match_score: 89,
        score_breakdown: { riasec: 36, ingreso: 26, costo: 16, admision: 11 },
        estimated: [],
        insight:
          'La más selectiva del grupo: entra el 7% de quienes postulan. Mismo costo ' +
          'anual que Sistemas y la misma casa de estudios.',
      },
      {
        career: 'Ingeniería Informática',
        career_family: 'Ingeniería',
        riasec_profile: 'RIA',
        institution: 'Universidad Nacional Federico Villarreal',
        institution_type: 'Universidad',
        management_type: 'Publica',
        location: 'Lima',
        duration_years: 5,
        monthly_income: 3678,
        annual_cost: 156,
        admission_rate: 28,
        match_score: 85,
        score_breakdown: { riasec: 34, ingreso: 22, costo: 15, admision: 14 },
        estimated: [],
        insight:
          'La más accesible del grupo, con un 28% de admisión, a cambio de un ingreso ' +
          'promedio menor.',
      },
    ],
    total_candidates: 6208,
    careers_matched: 3,
    filters_applied: ['region', 'gestion'],
    candidates_without_each_filter: { region: 6208, gestion: 1740 },
    scoring_version: 'mock',
    dataset_source: FUENTE,
    dataset_snapshot_date: FECHA_DEL_SNAPSHOT,
  };
}
