import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';

import { ReportsService } from './reports.service';
import { informeDeEjemplo } from './reports.mock';
import { environment } from '../../../environments/environment';

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportsService);
  });

  /*
   * ESTE BLOQUE ES LA PRUEBA DE REGRESIÓN DEL FALLO QUE CERRÓ LA FASE 6.
   *
   * `ReportsService` pedía los informes a `environment.apiUrl` —el API Gateway
   * de IDENTITY— y a una ruta, `/reports/latest`, que no existe en ninguno de
   * los dos. Con `useMocks` en false, que es como van cloud-dev y producción,
   * eso era un 404 garantizado en cada carga: el spinner eterno que veía el
   * estudiante.
   *
   * Los informes viven en OTRO API Gateway (`reportsApiUrl`), porque SAM
   * compila cada `AWS::Serverless::HttpApi` en su propio OpenAPI. Que las dos
   * URLs se parezcan es justo lo que hizo que el error pasara desapercibido, y
   * por eso estas pruebas afirman las dos cosas: que se usa la buena y que NO
   * se usa la otra.
   */
  describe('habla con el API Gateway de informes, no con el de identity', () => {
    let http: HttpTestingController;

    /*
     * Una URL centinela en vez del valor real, y `reportsApiUrl` se sustituye
     * ANTES de construir el servicio porque `base` se calcula en el
     * inicializador del campo.
     *
     * Sin el centinela estas pruebas no probarían el cableado sino la config:
     * en `environment.ts` (el que ven los tests) `reportsApiUrl` y `apiUrl`
     * coinciden a propósito, porque en local se trabaja con mocks y no hay dos
     * Gateways. Con los dos valores iguales, un servicio que leyera el campo
     * equivocado pasaría igual. Así se afirma de dónde sale la URL, no cuánto
     * vale.
     */
    const GATEWAY_DE_INFORMES = 'https://gateway-de-informes.test/v1';
    let urlOriginal: string;

    beforeEach(() => {
      urlOriginal = environment.reportsApiUrl;
      environment.reportsApiUrl = GATEWAY_DE_INFORMES;
      environment.useMocks = false;

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      service = TestBed.inject(ReportsService);
      http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      environment.reportsApiUrl = urlOriginal;
      environment.useMocks = true;
    });

    it('el listado va a reportsApiUrl', async () => {
      const pendiente = firstValueFrom(service.list());

      const req = http.expectOne(`${environment.reportsApiUrl}/reports`);
      expect(req.request.method).toBe('GET');
      req.flush({ reports: [informeDeEjemplo()] });

      expect((await pendiente).length).toBe(1);
      http.verify();
    });

    it('nunca pide informes al Gateway de identity', () => {
      firstValueFrom(service.list());

      // El fallo real: `base` salia de `environment.apiUrl`, que es el Gateway
      // de identity. Con el centinela puesto, seguir leyendo ese campo manda la
      // peticion a otro sitio y `expectNone` lo caza.
      http.expectNone(`${environment.apiUrl}/reports`);
      http.expectOne(`${GATEWAY_DE_INFORMES}/reports`).flush({ reports: [] });
      http.verify();
    });

    it('no existe /reports/latest: se pide el informe por su id', async () => {
      const pendiente = firstValueFrom(service.get('r-1'));

      http.expectNone(`${environment.reportsApiUrl}/reports/latest`);
      http.expectOne(`${environment.reportsApiUrl}/reports/r-1`).flush(informeDeEjemplo({ id: 'r-1' }));

      expect((await pendiente).id).toBe('r-1');
      http.verify();
    });

    it('un listado sin la clave `reports` no revienta la pantalla', async () => {
      const pendiente = firstValueFrom(service.list());
      http.expectOne(`${environment.reportsApiUrl}/reports`).flush({});

      expect(await pendiente).toEqual([]);
      http.verify();
    });

    it('el contenido se pide al sub-recurso /content', async () => {
      const pendiente = firstValueFrom(service.content('r-1'));

      const req = http.expectOne(`${environment.reportsApiUrl}/reports/r-1/content`);
      req.flush({ profile_summary: 'hola', careers: [] });

      expect((await pendiente).profile_summary).toBe('hola');
      http.verify();
    });

    /*
     * `responseType: 'blob'` no es un detalle de estilo: sin él, HttpClient
     * intenta parsear el PDF como JSON y falla con un error de parseo que no se
     * parece en nada al problema real. Se afirma explícitamente porque es el
     * tipo de línea que se pierde en un refactor sin que ningún test lo note.
     */
    it('el PDF se pide como blob, no como JSON', async () => {
      const pendiente = firstValueFrom(service.downloadPdf('r-1'));

      const req = http.expectOne(`${environment.reportsApiUrl}/reports/r-1/pdf`);
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));

      expect(await pendiente).toBeInstanceOf(Blob);
      http.verify();
    });
  });

  describe('sondeo de un informe en curso', () => {
    let http: HttpTestingController;

    beforeEach(() => {
      environment.useMocks = false;
      http = TestBed.inject(HttpTestingController);
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      environment.useMocks = true;
    });

    /*
     * El `true` del segundo argumento de `takeWhile` es lo que hace que la
     * emisión terminal salga. Sin él, el `ready` que cierra el ciclo se
     * descarta y la pantalla nunca llega a ver el informe terminado: se queda
     * generando para siempre, que es exactamente el bug que esto arregla.
     */
    it('emite el estado terminal y no solo los intermedios', async () => {
      const todos = lastValueFrom(service.poll('r-1').pipe(toArray()));

      await vi.advanceTimersByTimeAsync(0);
      http.expectOne(`${environment.reportsApiUrl}/reports/r-1`).flush(
        informeDeEjemplo({ id: 'r-1', status: 'pending' }),
      );

      await vi.advanceTimersByTimeAsync(2000);
      http.expectOne(`${environment.reportsApiUrl}/reports/r-1`).flush(
        informeDeEjemplo({ id: 'r-1', status: 'ready' }),
      );

      const emitidos = await todos;
      expect(emitidos.map((r) => r.status)).toEqual(['pending', 'ready']);
      http.verify();
    });

    it('deja de preguntar en cuanto el informe falla', async () => {
      const todos = lastValueFrom(service.poll('r-1').pipe(toArray()));

      await vi.advanceTimersByTimeAsync(0);
      http.expectOne(`${environment.reportsApiUrl}/reports/r-1`).flush(
        informeDeEjemplo({ id: 'r-1', status: 'failed', failureReason: 'sin RIASEC' }),
      );

      const emitidos = await todos;
      expect(emitidos.map((r) => r.status)).toEqual(['failed']);

      // Ni una peticion mas despues del estado terminal.
      await vi.advanceTimersByTimeAsync(10_000);
      http.verify();
    });
  });

  /*
   * Estas pruebas no comprueban comportamiento, comprueban HONESTIDAD, y por eso
   * fijan valores literales en vez de rangos.
   *
   * Hasta el 2026-08-08 esta pantalla mostraba tres carreras escritas a mano —una de ellas
   * con S/. 4.800 y 12% de admisión— rotuladas «Fuente: Ponte en Carrera 2024». Se comprobó
   * contra el dataset y dos de las tres no existían en él, mientras la tercera tenía otras
   * cifras. Un mock que inventa datos plausibles y los atribuye a un organismo público no se
   * nota al leer el código: parece dato real. Solo se detecta cruzándolo con la fuente.
   *
   * De ahí que los números vayan clavados: si alguien los cambia, la prueba falla y le
   * obliga a volver al CSV. Un rango o un `toBeGreaterThan` dejaría pasar exactamente el
   * problema que estas pruebas existen para impedir.
   */
  describe('las fichas de ejemplo se corresponden con filas reales del dataset', () => {
    /** Filas de `data/features.csv`, las tres con los cuatro flags de imputación en False. */
    const FILAS_VERIFICADAS = [
      {
        career: 'Ingeniería de Sistemas',
        institution: 'Universidad Nacional de Ingeniería',
        duration_years: 5,
        admission_rate: 0.13,
        monthly_income: 4900,
        annual_cost: 110,
      },
      {
        career: 'Ingeniería Mecatrónica',
        institution: 'Universidad Nacional de Ingeniería',
        duration_years: 5,
        admission_rate: 0.07,
        monthly_income: 4195,
        annual_cost: 110,
      },
      {
        career: 'Ingeniería Informática',
        institution: 'Universidad Nacional Federico Villarreal',
        duration_years: 5,
        admission_rate: 0.28,
        monthly_income: 3678,
        annual_cost: 156,
      },
    ];

    it('cada ficha lleva los valores exactos de su fila', async () => {
      expect(environment.useMocks).toBe(true);
      const contenido = await firstValueFrom(service.content('cualquiera'));

      contenido.careers.forEach((career, i) => {
        const fila = FILAS_VERIFICADAS[i];
        expect(career.career).toBe(fila.career);
        expect(career.institution).toBe(fila.institution);
        expect(career.duration_years).toBe(fila.duration_years);
        expect(career.admission_rate).toBe(fila.admission_rate);
        expect(career.monthly_income).toBe(fila.monthly_income);
        expect(career.annual_cost).toBe(fila.annual_cost);
      });
    });

    /*
     * La tasa va en 0–1 porque así la emite el agente. El contrato viejo la
     * tenía en 0–100 (`admissionRatePct`) y la plantilla la pintaba directa;
     * mezclar los dos convenios muestra «0.13%» donde corresponde 13%, que no
     * se parece a un error de programa sino a un dato malo.
     */
    it('la tasa de admisión va en 0-1, como la emite el agente', async () => {
      const contenido = await firstValueFrom(service.content('cualquiera'));

      for (const career of contenido.careers) {
        expect(career.admission_rate).toBeGreaterThan(0);
        expect(career.admission_rate).toBeLessThanOrEqual(1);
      }
    });

    it('la procedencia va en dos campos, sin fecha embebida en el texto', async () => {
      const contenido = await firstValueFrom(service.content('cualquiera'));

      expect(contenido.dataset_source).toBe('Ponte en Carrera (MINEDU)');
      expect(contenido.dataset_source).not.toMatch(/\d{4}/);
      expect(contenido.dataset_snapshot_date).toBe('2026-06-13');
    });

    it('ningún texto atribuye cifras a organismos que no son la fuente', async () => {
      // El MTPE nunca fue fuente de este proyecto: la única es Ponte en Carrera (MINEDU).
      // Aun así, dos fichas afirmaban «28% anual según MTPE» y «crecimiento del 34%».
      const contenido = await firstValueFrom(service.content('cualquiera'));
      const textos = contenido.careers.map((c) => c.insight).join(' ');

      expect(textos).not.toMatch(/MTPE|INEI|SUNEDU|seg[úu]n el Ministerio/i);
    });
  });
});
