import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { delay, map, switchMap, takeWhile } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Report,
  ReportContent,
  ReportList,
  esTerminal,
} from './report.model';
import { informeDeEjemplo, contenidoDeEjemplo } from './reports.mock';

/**
 * El informe de orientación contra el backend real (ADR-019, fase 6).
 *
 * **Este servicio NO dispara la generación, y eso es una decisión, no una
 * carencia.** El informe lo genera siempre el agente dentro de un turno de
 * chat (enmienda del 2026-08-09 a D4): el estudiante lo pide hablando, o pulsa
 * un botón que *envía un mensaje al chat*. `POST /v1/reports` es el registro
 * que hace el agente cuando empieza, no una entrada para el frontend.
 *
 * Se descartó que el backend llamara al agente y esperase: la generación son
 * 10–20 s de LLM más el render del PDF, contra el techo de 29 s de API
 * Gateway. Funcionaría hasta dejar de hacerlo, y fallaría justo en los
 * informes más largos.
 *
 * Lo que sí hace esta clase: leer el histórico, seguir uno en curso hasta que
 * termine, y traerse el documento y el PDF.
 */

/**
 * Cada cuánto se vuelve a preguntar por un informe en curso.
 *
 * 2 s y no menos: la generación son 10–20 s, así que bajar de aquí solo añade
 * peticiones sin adelantar el resultado. Y no más, porque por encima de unos
 * segundos la pantalla parece congelada.
 */
const INTERVALO_DE_SONDEO_MS = 2000;

/**
 * Cuánto se sigue preguntando antes de rendirse.
 *
 * Existe porque un informe puede quedarse en `pending` para siempre: el ADR lo
 * admite como riesgo aceptado (D4) — si el contenedor del agente reinicia a
 * mitad de la generación, la fila se queda huérfana y nadie la cierra. Sin
 * tope, esta pantalla sondearía indefinidamente contra una fila muerta.
 *
 * 3 minutos es holgado contra los 10–20 s del caso normal; lo que corta es el
 * caso patológico, no el lento.
 */
const TOPE_DE_SONDEO_MS = 3 * 60 * 1000;

const MAX_INTENTOS = Math.ceil(TOPE_DE_SONDEO_MS / INTERVALO_DE_SONDEO_MS);

@Service()
export class ReportsService {
  private http = inject(HttpClient);
  private base = `${environment.reportsApiUrl}/reports`;

  /**
   * El histórico del estudiante, tal como lo ordena el backend.
   *
   * No se reordena aquí: el orden es parte del contrato del endpoint, y
   * duplicar el criterio en el cliente es garantizar que algún día discrepen.
   */
  list(): Observable<Report[]> {
    if (environment.useMocks) {
      return of([informeDeEjemplo()]).pipe(delay(300));
    }
    return this.http.get<ReportList>(this.base).pipe(map((res) => res.reports ?? []));
  }

  get(reportId: string): Observable<Report> {
    if (environment.useMocks) {
      return of(informeDeEjemplo({ id: reportId })).pipe(delay(200));
    }
    return this.http.get<Report>(`${this.base}/${reportId}`);
  }

  /**
   * El documento en sí.
   *
   * Llega como el JSON crudo de S3 — el backend lo sirve tal cual, sin el sobre
   * `{success, data}`, para que el checksum de la fila siga describiendo lo que
   * recibe el cliente. `apiEnvelopeInterceptor` lo deja pasar intacto porque no
   * tiene la forma del sobre.
   */
  content(reportId: string): Observable<ReportContent> {
    if (environment.useMocks) {
      return of(contenidoDeEjemplo()).pipe(delay(300));
    }
    return this.http.get<ReportContent>(`${this.base}/${reportId}/content`);
  }

  /**
   * El PDF, como bytes.
   *
   * `responseType: 'blob'` es obligatorio: sin él, `HttpClient` intenta parsear
   * un PDF como JSON y falla con un error de parseo que no se parece en nada al
   * problema real.
   *
   * Va por el backend con el JWT delante y no por una URL firmada de S3
   * (ADR-019 D3). El `authInterceptor` pone la cabecera en todas las peticiones,
   * así que no hay que hacer nada especial aquí.
   */
  downloadPdf(reportId: string): Observable<Blob> {
    return this.http.get(`${this.base}/${reportId}/pdf`, { responseType: 'blob' });
  }

  /**
   * Sigue un informe hasta que deje de moverse.
   *
   * Emite cada lectura, no solo la última, para que la pantalla pueda ir
   * contando lo que pasa en vez de quedarse muda hasta el final.
   *
   * `takeWhile(..., true)` con el segundo argumento en `true` es lo que hace que
   * la emisión terminal SÍ salga: sin él, el `ready` que cierra el ciclo se
   * descartaría y la pantalla no llegaría a ver nunca el informe terminado.
   */
  poll(reportId: string): Observable<Report> {
    return timer(0, INTERVALO_DE_SONDEO_MS).pipe(
      switchMap((intento) =>
        this.get(reportId).pipe(
          map((informe) => ({ informe, agotado: intento >= MAX_INTENTOS })),
        ),
      ),
      takeWhile(({ informe, agotado }) => !esTerminal(informe.status) && !agotado, true),
      map(({ informe }) => informe),
    );
  }
}
