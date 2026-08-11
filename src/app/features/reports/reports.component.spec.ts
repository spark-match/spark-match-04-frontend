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
   * La tasa llega en 0-1 y se enseña en 0-100. Pintarla directa mostraría
   * «0.13%» donde corresponde 13%, y eso no se lee como un fallo de programa
   * sino como un dato malo: un estudiante creería que entra el 0,13% de los
   * postulantes.
   */
  it('convierte la tasa de admisión de 0-1 a porcentaje', () => {
    expect(component.admisionEnPorcentaje(component.careers()[0])).toBe(13);

    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('13%');
    expect(html).not.toContain('0.13%');
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
        list: vi.fn().mockReturnValue(
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
      expect((f.nativeElement as HTMLElement).textContent).toContain('No pudimos generar tu reporte');
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

      const f = await montar(
        servicioFalso({ content: vi.fn().mockReturnValue(of(contenido)) }),
      );

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

  it('el contenido de ejemplo tiene la forma del contrato real', () => {
    const contenido: ReportContent = contenidoDeEjemplo();
    expect(contenido.schema_version).toBeTruthy();
    expect(contenido.careers[0].score_breakdown).toBeTypeOf('object');
    expect(Array.isArray(contenido.careers[0].estimated)).toBe(true);
  });
});
