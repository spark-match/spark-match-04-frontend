import { Report, etiquetaDeProcedencia, fechaDelInforme, resumenDelInforme } from './report.model';
import { informeDeEjemplo } from './reports.mock';

/*
 * Las tres son funciones puras y viven aquí, fuera del componente, justamente
 * para poder probarse sin montar una pantalla. Lo que fijan es texto que lee un
 * estudiante, así que los casos raros —una fecha inválida, una fila sin
 * carreras— importan tanto como el camino feliz: cualquiera de ellos acaba
 * pintado tal cual en la lista del histórico.
 */

describe('fechaDelInforme', () => {
  it('escribe el día, el mes en castellano y la hora', () => {
    // Se construye con `new Date(...)` en local y no con una cadena UTC: la
    // función formatea en la zona del navegador —que es la del estudiante— y
    // un literal con Z haría que el test dependiera de dónde corra.
    const local = new Date(2026, 7, 11, 14, 32).toISOString();

    expect(fechaDelInforme(local)).toBe('11 de agosto de 2026, 14:32');
  });

  it('rellena la hora y el minuto con cero', () => {
    const local = new Date(2026, 0, 5, 9, 7).toISOString();

    expect(fechaDelInforme(local)).toBe('5 de enero de 2026, 09:07');
  });

  it('setiembre va con e, que es como se escribe en Perú', () => {
    const local = new Date(2026, 8, 1, 12, 0).toISOString();

    expect(fechaDelInforme(local)).toContain('setiembre');
  });

  it('una fecha que no se entiende no pinta «Invalid Date» en la pantalla', () => {
    // `new Date('lo que sea')` no lanza: devuelve una fecha inválida, y
    // formatearla sin mirar deja «NaN de undefined de NaN» en la lista.
    expect(fechaDelInforme('no-es-una-fecha')).toBe('');
    expect(fechaDelInforme('')).toBe('');
  });
});

describe('resumenDelInforme', () => {
  const con = (extra: Partial<Report>) => resumenDelInforme(informeDeEjemplo(extra));

  it('con una o dos carreras las dice enteras', () => {
    expect(con({ topCareers: ['Ingeniería Civil'] })).toBe('Ingeniería Civil');
    expect(con({ topCareers: ['Ingeniería Civil', 'Arquitectura'] })).toBe(
      'Ingeniería Civil · Arquitectura',
    );
  });

  it('con más de dos enseña las primeras y cuenta el resto', () => {
    expect(con({ topCareers: ['Una', 'Dos', 'Tres', 'Cuatro'] })).toBe('Una · Dos y 2 más');
  });

  it('un informe en curso dice en qué punto va, no una lista vacía', () => {
    expect(con({ status: 'pending', topCareers: null })).toBe('Generándose…');
  });

  it('un informe fallido lo dice', () => {
    expect(con({ status: 'failed', topCareers: null })).toBe('No se pudo generar');
  });

  /*
   * Casi cada campo de la fila es nullable a propósito: el backend prefiere
   * decir `null` a inventar un valor. Una fila `ready` sin `topCareers` no
   * debería existir, pero el contrato la permite y aquí acabaría pintando una
   * pestaña con la fecha y nada debajo.
   */
  it('una fila lista pero sin carreras no deja el hueco en blanco', () => {
    expect(con({ topCareers: null })).toBe('Sin carreras registradas');
    expect(con({ topCareers: [] })).toBe('Sin carreras registradas');
  });
});

describe('etiquetaDeProcedencia', () => {
  it('junta la fuente y la fecha en el formato de la pantalla', () => {
    expect(etiquetaDeProcedencia('Ponte en Carrera (MINEDU)', '2026-06-13')).toBe(
      'Ponte en Carrera (MINEDU) · datos del 13/06/2026',
    );
  });

  it('sin fecha se queda con la fuente sola', () => {
    expect(etiquetaDeProcedencia('Ponte en Carrera (MINEDU)', null)).toBe(
      'Ponte en Carrera (MINEDU)',
    );
  });

  it('sin fuente no dice nada, en vez de citar una fecha huérfana', () => {
    expect(etiquetaDeProcedencia(null, '2026-06-13')).toBe('');
  });
});
