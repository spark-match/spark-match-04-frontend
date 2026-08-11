import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ReportsComponent } from './reports.component';
import { ReportsService } from './reports.service';
import { Report, ReportContent } from './report.model';
import { informeDeEjemplo, contenidoDeEjemplo } from './reports.mock';

function servicioFalso(overrides: Partial<Record<keyof ReportsService, unknown>> = {}) {
  return {
    list: vi.fn().mockReturnValue(of([informeDeEjemplo()])),
    get: vi.fn().mockReturnValue(of(informeDeEjemplo())),
    content: vi.fn().mockReturnValue(of(contenidoDeEjemplo())),
    poll: vi.fn().mockReturnValue(of(informeDeEjemplo())),
    downloadPdf: vi.fn().mockReturnValue(of(new Blob(['%PDF-1.7']))),
    ...overrides,
  };
}

async function montar(servicio: ReturnType<typeof servicioFalso>) {
  await TestBed.configureTestingModule({
    imports: [ReportsComponent],
    providers: [{ provide: ReportsService, useValue: servicio }],
  }).compileComponents();

  const fixture = TestBed.createComponent(ReportsComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let servicio: ReturnType<typeof servicioFalso>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    servicio = servicioFalso();
    fixture = await montar(servicio);
    component = fixture.componentInstance;
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('pide el histórico al arrancar, no un informe concreto', () => {
    expect(servicio.list).toHaveBeenCalledOnce();
  });

  it('expone las carreras del contenido, no de la fila', () => {
    expect(component.careers().length).toBe(3);
    expect(component.careersFound()).toBe(3);
    expect(component.careers()[0].career).toBe('Ingeniería de Sistemas');
  });

  it('expone el resumen de perfil que escribió el modelo', () => {
    expect(component.profile()).toContain('realista');
  });

  it('pinta las fichas en la plantilla', () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelectorAll('.report__card').length).toBe(3);
    expect(html.textContent).toContain('Ingeniería Mecatrónica');
  });

  /*
   * La tasa llega ya en 0-100 —es la columna del catálogo— y aquí sólo se
   * redondea. Este test decía «convierte de 0-1» y multiplicaba, que es lo
   * que enseñaba «1300%» donde corresponde 13%. Y eso no se lee como un fallo
   * de programa sino como un dato malo.
   */
  it('enseña la tasa de admisión tal como viene, sin multiplicarla', () => {
    expect(component.admisionEnPorcentaje(component.careers()[0])).toBe(13);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('13%');
    expect(html).not.toContain('1300%');
  });

  describe('la procedencia sale del dato, no de la plantilla', () => {
    /*
     * El banner citaba la fuente escrita a mano en la plantilla: «Datos: Ponte en
     * Carrera 2024». Cuando el 2026-08-08 se corrigió la atribución de las fichas,
     * el banner no se enteró y la pantalla quedó diciendo dos fechas distintas a la
     * vez. Se detectó descargando el bundle desplegado y buscando la cadena vieja,
     * no leyendo el código.
     *
     * Ahora sale de los DOS campos de la fila, compuestos en un solo sitio. El
     * fixture usa un valor deliberadamente inventado: si alguien vuelve a
     * escribirla en la plantilla, el texto no coincidirá y la prueba caerá.
     */
    it('compone la etiqueta con la fuente y la fecha de la fila', async () => {
      TestBed.resetTestingModule();
      const otro = servicioFalso({
        list: vi.fn().mockReturnValue(
          of([
            informeDeEjemplo({
              datasetSource: 'FUENTE-DE-PRUEBA-XYZ',
              datasetSnapshotDate: '2026-01-31',
            }),
          ]),
        ),
      });
      const f = await montar(otro);

      const banner = (f.nativeElement as HTMLElement).querySelector('.report__banner');
      expect(banner?.textContent).toContain('FUENTE-DE-PRUEBA-XYZ');
      expect(banner?.textContent).toContain('31/01/2026');
    });

    it('no lleva ninguna fuente escrita a mano en la plantilla', () => {
      const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(html).not.toContain('Ponte en Carrera 2024');
    });

    it('no rompe cuando la fila no trae procedencia', async () => {
      TestBed.resetTestingModule();
      const otro = servicioFalso({
        list: vi
          .fn()
          .mockReturnValue(
            of([informeDeEjemplo({ datasetSource: null, datasetSnapshotDate: null })]),
          ),
      });
      const f = await montar(otro);

      expect(f.componentInstance.dataSource()).toBe('');
    });
  });

  /*
   * El caso que ANTES NO EXISTÍA. Un estudiante que todavía no ha pedido su
   * informe caía en la misma rama que un fallo y leía «No pudimos generar tu
   * reporte»: se le culpaba de un error que no había ocurrido, y encima el
   * mensaje no le decía lo único que necesitaba saber, que el informe se pide
   * hablando con el orientador.
   */
  describe('cuando el estudiante todavía no tiene informes', () => {
    let vacio: ComponentFixture<ReportsComponent>;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      vacio = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of([])) }));
    });

    it('no lo trata como un fallo', () => {
      expect(vacio.componentInstance.estado()).toBe('sin-informe');
      const html = (vacio.nativeElement as HTMLElement).textContent ?? '';
      expect(html).not.toContain('No pudimos generar tu reporte');
    });

    it('le dice que el informe se pide en el chat', () => {
      const html = (vacio.nativeElement as HTMLElement).textContent ?? '';
      expect(html).toContain('Todavía no tienes un reporte');
      expect(html).toContain('chat');
    });

    it('no intenta traer el contenido de un informe que no existe', () => {
      expect(vacio.componentInstance.contenido()).toBeNull();
    });
  });

  describe('cuando hay un informe en curso', () => {
    it('sigue el informe y enseña el contenido al terminar', async () => {
      TestBed.resetTestingModule();
      const emisiones = new Subject<Report>();
      const servicioLento = servicioFalso({
        list: vi.fn().mockReturnValue(of([informeDeEjemplo({ status: 'pending' })])),
        poll: vi.fn().mockReturnValue(emisiones.asObservable()),
      });
      const f = await montar(servicioLento);

      expect(f.componentInstance.estado()).toBe('generando');
      expect((f.nativeElement as HTMLElement).textContent).toContain('Generando tu reporte');

      emisiones.next(informeDeEjemplo({ status: 'ready' }));
      f.detectChanges();

      expect(f.componentInstance.estado()).toBe('listo');
      expect(servicioLento.content).toHaveBeenCalled();
    });

    /*
     * Un informe puede quedarse en `pending` para siempre: el ADR lo admite como
     * riesgo aceptado (D4) si el contenedor del agente reinicia a mitad de la
     * generación. Sin esta rama, la pantalla se quedaría girando contra una fila
     * muerta — la misma mentira que el spinner eterno que esto vino a arreglar.
     */
    it('se rinde si el sondeo termina sin llegar a estado terminal', async () => {
      TestBed.resetTestingModule();
      const emisiones = new Subject<Report>();
      const f = await montar(
        servicioFalso({
          list: vi.fn().mockReturnValue(of([informeDeEjemplo({ status: 'pending' })])),
          poll: vi.fn().mockReturnValue(emisiones.asObservable()),
        }),
      );

      expect(f.componentInstance.estado()).toBe('generando');
      emisiones.complete();
      f.detectChanges();

      expect(f.componentInstance.estado()).toBe('fallido');
    });
  });

  /*
   * `list()` siempre devolvió el histórico entero; esta pantalla se quedaba con
   * `[0]` y tiraba el resto. Un estudiante que pide un segundo informe tras
   * rehacer el cuestionario perdía el primero de vista sin que nada se lo
   * dijera, y la comparación entre los dos —que es justo para lo que sirve
   * pedir otro— no existía.
   */
  describe('el histórico', () => {
    const tres = () => [
      informeDeEjemplo({ id: 'nuevo', createdAt: '2026-08-11T09:00:00Z' }),
      informeDeEjemplo({
        id: 'medio',
        createdAt: '2026-08-04T09:00:00Z',
        topCareers: ['Ingeniería Civil', 'Arquitectura'],
      }),
      informeDeEjemplo({ id: 'viejo', status: 'failed', createdAt: '2026-07-28T09:00:00Z' }),
    ];

    it('con un solo informe no ofrece elegir', () => {
      // Una lista de un elemento no es una elección, es ruido encima del
      // informe que ya se está enseñando.
      expect(component.hayHistorico()).toBe(false);
      expect((fixture.nativeElement as HTMLElement).querySelector('.report__history')).toBeNull();
    });

    it('con varios los enseña y abre el más reciente', async () => {
      TestBed.resetTestingModule();
      const f = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of(tres())) }));

      const botones = (f.nativeElement as HTMLElement).querySelectorAll('.report__history-item');
      expect(botones.length).toBe(3);
      expect(f.componentInstance.informe()?.id).toBe('nuevo');
    });

    it('al elegir otro trae SU contenido', async () => {
      TestBed.resetTestingModule();
      // El espía se declara aquí y se inyecta, en vez de sacarlo del objeto
      // falso: el tipo de `servicioFalso` ensancha los overrides a `unknown` y
      // desde ahí no se puede llamar a `mockClear`.
      const content = vi.fn().mockReturnValue(of(contenidoDeEjemplo()));
      const f = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of(tres())), content }));
      content.mockClear();

      f.componentInstance.seleccionar(f.componentInstance.informes()[1]);
      f.detectChanges();

      expect(f.componentInstance.informe()?.id).toBe('medio');
      expect(content).toHaveBeenCalledWith('medio');
    });

    it('volver a pulsar el que ya está abierto no lo recarga', async () => {
      TestBed.resetTestingModule();
      const content = vi.fn().mockReturnValue(of(contenidoDeEjemplo()));
      const f = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of(tres())), content }));
      content.mockClear();

      f.componentInstance.seleccionar(f.componentInstance.informes()[0]);

      expect(content).not.toHaveBeenCalled();
    });

    /*
     * El fallo que tenía todas las papeletas de colarse: sin cortar la
     * suscripción anterior, el sondeo del informe que estabas viendo sigue vivo
     * al cambiar de informe y escribe en las mismas señales. Eliges el de julio
     * y a los dos segundos vuelve el de agosto, sin que nada lo explique.
     */
    it('cambiar de informe corta el sondeo del anterior', async () => {
      TestBed.resetTestingModule();
      const emisiones = new Subject<Report>();
      const enCurso = [
        informeDeEjemplo({ id: 'en-curso', status: 'pending' }),
        informeDeEjemplo({ id: 'terminado' }),
      ];
      const f = await montar(
        servicioFalso({
          list: vi.fn().mockReturnValue(of(enCurso)),
          poll: vi.fn().mockReturnValue(emisiones.asObservable()),
        }),
      );
      expect(f.componentInstance.estado()).toBe('generando');

      f.componentInstance.seleccionar(f.componentInstance.informes()[1]);
      f.detectChanges();
      expect(f.componentInstance.informe()?.id).toBe('terminado');

      // El sondeo del primero emite DESPUÉS del cambio. Si siguiera conectado,
      // esto devolvería la pantalla al informe anterior.
      emisiones.next(informeDeEjemplo({ id: 'en-curso', status: 'ready' }));
      f.detectChanges();

      expect(f.componentInstance.informe()?.id).toBe('terminado');
    });

    it('un informe fallido se puede abrir y cuenta por qué falló', async () => {
      TestBed.resetTestingModule();
      const f = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of(tres())) }));

      f.componentInstance.seleccionar(f.componentInstance.informes()[2]);
      f.detectChanges();

      expect(f.componentInstance.estado()).toBe('fallido');
    });

    it('marca cuál está abierto', async () => {
      TestBed.resetTestingModule();
      const f = await montar(servicioFalso({ list: vi.fn().mockReturnValue(of(tres())) }));

      const activos = (f.nativeElement as HTMLElement).querySelectorAll(
        '.report__history-item--activo',
      );
      expect(activos.length).toBe(1);
      expect(activos[0].textContent).toContain('Ingeniería de Sistemas');
    });
  });

  /*
   * Hasta el 2026-08-09 la suscripción solo tenía rama de éxito, así que un
   * fallo no bajaba nunca `loading` y la pantalla se quedaba en «Generando tu
   * reporte...» indefinidamente, sin mensaje y sin salida.
   *
   * Y no era el caso raro, era EL caso: en los entornos desplegados `useMocks`
   * va en false y el servicio pedía los informes al Gateway equivocado, así que
   * la petición siempre terminaba en 404.
   */
  describe('cuando algo falla', () => {
    it('el fallo del listado sale por pantalla, no en un spinner eterno', async () => {
      TestBed.resetTestingModule();
      const f = await montar(
        servicioFalso({ list: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) }),
      );

      expect(f.componentInstance.estado()).toBe('fallido');
      expect((f.nativeElement as HTMLElement).textContent).toContain(
        'No pudimos generar tu reporte',
      );
    });

    it('una fila lista cuyo contenido no se puede traer también es un fallo', async () => {
      TestBed.resetTestingModule();
      const f = await montar(
        servicioFalso({ content: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) }),
      );

      expect(f.componentInstance.estado()).toBe('fallido');
    });

    /*
     * El motivo SÍ se enseña, al contrario que el detalle de un error de red.
     * Viene acotado a 500 caracteres desde el backend y redactado para el
     * estudiante: «tu perfil aún no tiene código RIASEC» le dice qué hacer.
     */
    it('enseña el motivo cuando el backend da uno', async () => {
      TestBed.resetTestingModule();
      const f = await montar(
        servicioFalso({
          list: vi.fn().mockReturnValue(
            of([
              informeDeEjemplo({
                status: 'failed',
                failureReason: 'Tu perfil aún no tiene código RIASEC',
              }),
            ]),
          ),
        }),
      );

      expect((f.nativeElement as HTMLElement).textContent).toContain('código RIASEC');
    });

    /*
     * Dos fallos distintos detrás de la misma pantalla, y sólo uno se arregla
     * volviendo a pedir. Que la petición se caiga es temporal. Que la FILA esté
     * en `failed` no: ese informe falló al generarse y volver a pedirlo
     * devolverá lo mismo para siempre. Se nota desde que se puede abrir un
     * informe viejo del histórico.
     */
    it('un informe que falló al generarse no ofrece reintentar', async () => {
      TestBed.resetTestingModule();
      const f = await montar(
        servicioFalso({
          list: vi.fn().mockReturnValue(of([informeDeEjemplo({ status: 'failed' })])),
        }),
      );

      expect((f.nativeElement as HTMLElement).querySelector('.report__retry')).toBeNull();
      expect((f.nativeElement as HTMLElement).textContent).toContain('Pídele uno nuevo');
    });

    it('un fallo de red sí ofrece reintentar', async () => {
      TestBed.resetTestingModule();
      const f = await montar(
        servicioFalso({ list: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) }),
      );

      expect((f.nativeElement as HTMLElement).querySelector('.report__retry')).toBeTruthy();
    });
  });

  describe('exportar a PDF', () => {
    /*
     * Antes esto era `window.print()`, que imprime la PANTALLA: el menú del
     * navegador, la maquetación de la web, y ninguna de las decisiones
     * tipográficas del informe. El PDF de verdad lo renderiza el agente con
     * WeasyPrint (ADR-019 D11) y es el que el estudiante puede enseñar en casa.
     */
    it('descarga el PDF del backend y no imprime la pantalla', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const createObjectURL = vi.fn().mockReturnValue('blob:x');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

      component.exportPdf();

      expect(servicio.downloadPdf).toHaveBeenCalledWith('mock-report-1');
      expect(printSpy).not.toHaveBeenCalled();
      // Sin el revoke, cada descarga deja su blob en memoria hasta recargar.
      expect(revokeObjectURL).toHaveBeenCalled();

      vi.unstubAllGlobals();
      printSpy.mockRestore();
    });

    it('no descarga nada si el informe no está listo', async () => {
      TestBed.resetTestingModule();
      const otro = servicioFalso({ list: vi.fn().mockReturnValue(of([])) });
      const f = await montar(otro);

      f.componentInstance.exportPdf();

      expect(otro.downloadPdf).not.toHaveBeenCalled();
    });
  });

  it('corta el sondeo al salir de la pantalla', async () => {
    TestBed.resetTestingModule();
    const emisiones = new Subject<Report>();
    const f = await montar(
      servicioFalso({
        list: vi.fn().mockReturnValue(of([informeDeEjemplo({ status: 'pending' })])),
        poll: vi.fn().mockReturnValue(emisiones.asObservable()),
      }),
    );

    expect(emisiones.observed).toBe(true);
    f.destroy();

    // Sin el unsubscribe del ngOnDestroy, el sondeo sigue vivo despues de
    // salir: una peticion cada dos segundos, para siempre.
    expect(emisiones.observed).toBe(false);
  });

  /*
   * Sin este aviso, una mediana de familia de carrera se presenta igual que un
   * dato medido y publicado por el MINEDU. El agente arrastra la lista
   * `estimated` hasta el informe impreso justamente para poder distinguirlos, y
   * tirarla aquí desharía esa cadena entera en el último paso.
   */
  describe('las cifras estimadas se marcan como tales', () => {
    it('avisa cuando una ficha trae medianas de su familia', async () => {
      TestBed.resetTestingModule();
      const contenido = contenidoDeEjemplo();
      contenido.careers[0].estimated = ['monthly_income', 'annual_cost'];

      const f = await montar(servicioFalso({ content: vi.fn().mockReturnValue(of(contenido)) }));

      const primera = (f.nativeElement as HTMLElement).querySelector('.report__card');
      expect(primera?.textContent).toContain('Estimado a partir de carreras similares');
      expect(primera?.textContent).toContain('monthly_income');
    });

    it('no ensucia las fichas cuyas cifras son todas medidas', () => {
      expect(component.tieneEstimados(component.careers()[0])).toBe(false);
      const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(html).not.toContain('Estimado a partir de');
    });
  });

  describe('la tasa de admisión y el retrato del perfil', () => {
    /*
     * El dato llega en 0–100 y esta pantalla lo multiplicaba por cien, así que
     * el 13% de Ingeniería de Sistemas se pintaba como «1300%». En producción
     * fue peor de ver: «1700%», «4600%», «800%», al lado de un texto del
     * agente que decía 17%, 46% y 8%.
     */
    it('pinta la tasa tal como viene, sin multiplicarla', () => {
      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(texto).toContain('13%');
      expect(texto).not.toContain('1300%');
    });

    it('el retrato del perfil no vive en la cabecera fija', () => {
      /*
       * Estaba dentro de `.report__header`, que es `sticky`. Son dos o tres
       * párrafos, así que la franja fija crecía hasta media pantalla y se
       * quedaba por encima de las fichas al bajar.
       */
      const header = (fixture.nativeElement as HTMLElement).querySelector('.report__header');

      expect(header?.querySelector('.report__profile-text')).toBeNull();
      expect(header?.textContent).toContain('Reporte de Orientación');
    });

    it('el retrato sale en su propia tarjeta', () => {
      const tarjeta = (fixture.nativeElement as HTMLElement).querySelector('.report__profile-card');

      expect(tarjeta).not.toBeNull();
      expect(tarjeta?.textContent).toContain('Tu perfil vocacional');
    });

    it('parte el retrato en párrafos por las líneas en blanco', async () => {
      TestBed.resetTestingModule();
      const contenido = contenidoDeEjemplo();
      contenido.profile_summary = ['Primer párrafo.', 'Segundo párrafo.', 'Tercero.'].join('\n\n');
      const otro = servicioFalso({ content: vi.fn().mockReturnValue(of(contenido)) });
      const f = await montar(otro);

      const parrafos = (f.nativeElement as HTMLElement).querySelectorAll('.report__profile-text');

      expect(parrafos.length).toBe(3);
      expect(parrafos[0].textContent?.trim()).toBe('Primer párrafo.');
      expect(parrafos[2].textContent?.trim()).toBe('Tercero.');
    });

    it('un retrato de un solo bloque sigue saliendo entero', async () => {
      TestBed.resetTestingModule();
      const contenido = contenidoDeEjemplo();
      contenido.profile_summary = 'Un bloque seguido, sin saltos.';
      const otro = servicioFalso({ content: vi.fn().mockReturnValue(of(contenido)) });
      const f = await montar(otro);

      const parrafos = (f.nativeElement as HTMLElement).querySelectorAll('.report__profile-text');

      expect(parrafos.length).toBe(1);
      expect(parrafos[0].textContent?.trim()).toBe('Un bloque seguido, sin saltos.');
    });
  });

  it('el contenido de ejemplo tiene la forma del contrato real', () => {
    const contenido: ReportContent = contenidoDeEjemplo();
    expect(contenido.schema_version).toBeTruthy();
    expect(contenido.careers[0].score_breakdown).toBeTypeOf('object');
    expect(Array.isArray(contenido.careers[0].estimated)).toBe(true);
  });
});
