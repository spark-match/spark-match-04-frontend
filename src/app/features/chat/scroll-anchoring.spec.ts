import { describe, expect, it } from 'vitest';

import { MARGEN_DE_FONDO_PX, distanciaAlFondo, estaPegadoAlFondo } from './scroll-anchoring';

/** Una caja de 500px de alto con `contenido` px dentro, desplazada a `arriba`. */
function caja(contenido: number, arriba: number, alto = 500) {
  return { scrollHeight: contenido, scrollTop: arriba, clientHeight: alto };
}

describe('distanciaAlFondo', () => {
  it('vale 0 cuando la caja esta abajo del todo', () => {
    expect(distanciaAlFondo(caja(2000, 1500))).toBe(0);
  });

  it('cuenta los pixeles que faltan', () => {
    expect(distanciaAlFondo(caja(2000, 1100))).toBe(400);
  });

  it('vale 0 cuando el contenido no desborda', () => {
    expect(distanciaAlFondo(caja(300, 0))).toBeLessThanOrEqual(0);
  });
});

describe('estaPegadoAlFondo', () => {
  it('si esta abajo del todo', () => {
    expect(estaPegadoAlFondo(caja(2000, 1500))).toBe(true);
  });

  it('si le falta menos que el margen', () => {
    expect(estaPegadoAlFondo(caja(2000, 1500 - (MARGEN_DE_FONDO_PX - 1)))).toBe(true);
  });

  it('justo en el margen sigue contando como pegado', () => {
    expect(estaPegadoAlFondo(caja(2000, 1500 - MARGEN_DE_FONDO_PX))).toBe(true);
  });

  it('un pixel mas alla ya es despegado', () => {
    expect(estaPegadoAlFondo(caja(2000, 1500 - MARGEN_DE_FONDO_PX - 1))).toBe(false);
  });

  it('subir a releer despega', () => {
    expect(estaPegadoAlFondo(caja(4000, 800))).toBe(false);
  });

  /**
   * El caso que justifica que el margen no sea cero: entre dos repintados el
   * agente añadio una linea, asi que el contenido crecio y el scroll todavia
   * no. Sin margen esto daria «despegado» y el chat dejaria de seguir al
   * primer token.
   */
  it('un chorro de texto nuevo no cuenta como despegarse', () => {
    const antes = caja(2000, 1500);
    const despues = caja(antes.scrollHeight + 24, antes.scrollTop);
    expect(estaPegadoAlFondo(despues)).toBe(true);
  });

  it('una caja que no desborda cuenta como pegada, no como despegada', () => {
    // Si no, el boton de «bajar al ultimo» saldria en un chat de dos mensajes,
    // ofreciendo ir a un sitio donde ya estas.
    expect(estaPegadoAlFondo(caja(300, 0))).toBe(true);
  });

  it('respeta un margen a medida', () => {
    expect(estaPegadoAlFondo(caja(2000, 1400), 50)).toBe(false);
    expect(estaPegadoAlFondo(caja(2000, 1400), 200)).toBe(true);
  });

  describe('cuando la conversacion apenas desborda', () => {
    /**
     * Medido el 2026-08-09: recorrido total de 100px contra un margen fijo de
     * 120. El margen se tragaba el recorrido entero, asi que estando arriba
     * del todo se seguia considerando «pegado»: el boton no aparecia nunca y
     * cada mensaje nuevo arrastraba al lector que se habia subido a releer.
     */
    it('subir arriba del todo despega aunque el recorrido sea menor que el margen', () => {
      const recorridoDe100 = caja(655, 0, 555);
      expect(recorridoDe100.scrollHeight - recorridoDe100.clientHeight).toBeLessThan(
        MARGEN_DE_FONDO_PX,
      );
      expect(estaPegadoAlFondo(recorridoDe100)).toBe(false);
    });

    it('la mitad de abajo sigue contando como pegado', () => {
      // Recorrido 100 -> margen efectivo 50. A 60px de arriba faltan 40 para
      // el fondo, asi que seguir escribiendo debajo es lo que el lector espera.
      expect(estaPegadoAlFondo(caja(655, 60, 555))).toBe(true);
    });

    it('el margen completo se mantiene en conversaciones largas', () => {
      // Recorrido 1500: la mitad son 750, muy por encima de 120, asi que el
      // que manda es el margen fijo y el comportamiento no cambia.
      expect(estaPegadoAlFondo(caja(2000, 1500 - MARGEN_DE_FONDO_PX, 500))).toBe(true);
      expect(estaPegadoAlFondo(caja(2000, 1500 - MARGEN_DE_FONDO_PX - 1, 500))).toBe(false);
    });
  });
});
