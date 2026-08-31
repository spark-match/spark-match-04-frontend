import { describe, expect, it } from 'vitest';

import { ActivityGroup } from './activity-grouping';
import { ChatActivity } from './chat.model';
import { contarPasos, resumenDeActividad } from './activity-summary';

function llamada(id: string): ChatActivity {
  return { id, label: 'x', running: false, kind: 'tool' };
}

function grupo(
  label: string,
  kind: ActivityGroup['kind'],
  llamadas = 1,
  ok?: boolean,
): ActivityGroup {
  return {
    key: label,
    label,
    kind,
    running: false,
    ok,
    calls: Array.from({ length: llamadas }, (_, i) => llamada(`${label}-${i}`)),
  };
}

describe('contarPasos', () => {
  it('cuenta llamadas, no grupos', () => {
    // Un chip que agrupa seis busquedas son seis pasos. Contar grupos diria
    // «1 paso» de un turno que hizo seis cosas.
    expect(contarPasos([grupo('Buscando…', 'tool', 6)])).toBe(6);
  });

  it('suma entre grupos', () => {
    expect(contarPasos([grupo('a', 'tool', 2), grupo('b', 'search', 3)])).toBe(5);
  });
});

describe('resumenDeActividad', () => {
  it('sin actividad no hay resumen', () => {
    expect(resumenDeActividad([])).toBeNull();
  });

  it('le quita los puntos suspensivos a la etiqueta', () => {
    // El chip esta escrito en gerundio porque nace mientras la cosa ocurre.
    // En el resumen ya termino: dejar los puntos haria creer que sigue.
    const resumen = resumenDeActividad([grupo('Buscando en internet…', 'search')]);
    expect(resumen?.titulo).toBe('Buscando en internet');
  });

  describe('elige el chip que mejor representa el turno', () => {
    it('una delegacion manda sobre todo lo demas', () => {
      const resumen = resumenDeActividad([
        grupo('Consultando el catálogo…', 'tool'),
        grupo('Buscando en internet…', 'search'),
        grupo('Hablando con el especialista…', 'subagent'),
      ]);
      expect(resumen?.titulo).toBe('Hablando con el especialista');
    });

    it('una busqueda manda sobre una consulta al catalogo', () => {
      // Es lo que mas cambia cuanto fiarse de la respuesta, asi que si el
      // turno salio a internet el resumen tiene que decirlo.
      const resumen = resumenDeActividad([
        grupo('Consultando el catálogo…', 'tool'),
        grupo('Buscando en internet…', 'search'),
      ]);
      expect(resumen?.titulo).toBe('Buscando en internet');
    });

    it('con solo herramientas normales gana la primera', () => {
      const resumen = resumenDeActividad([
        grupo('Consultando el catálogo…', 'tool'),
        grupo('Calculando tu afinidad…', 'tool'),
      ]);
      expect(resumen?.titulo).toBe('Consultando el catálogo');
    });
  });

  it('cuenta todos los pasos, no solo los del chip elegido', () => {
    const resumen = resumenDeActividad([
      grupo('Consultando el catálogo…', 'tool', 6),
      grupo('Buscando en internet…', 'search', 2),
    ]);
    expect(resumen?.pasos).toBe(8);
  });

  describe('un fallo no se pliega en silencio', () => {
    it('marca el resumen cuando alguno fallo', () => {
      const resumen = resumenDeActividad([
        grupo('Consultando el catálogo…', 'tool'),
        grupo('Hablando con el especialista…', 'subagent', 1, false),
      ]);
      expect(resumen?.ok).toBe(false);
    });

    it('sin fallos va en ok', () => {
      const resumen = resumenDeActividad([grupo('Consultando el catálogo…', 'tool')]);
      expect(resumen?.ok).toBe(true);
    });

    it('un ok sin definir no cuenta como fallo', () => {
      // La mayoria de los chips nunca ponen `ok`: solo las delegaciones lo
      // traen. Tratarlo como fallo pintaria de rojo casi todos los turnos.
      const resumen = resumenDeActividad([grupo('Buscando en internet…', 'search', 1, undefined)]);
      expect(resumen?.ok).toBe(true);
    });
  });
});
