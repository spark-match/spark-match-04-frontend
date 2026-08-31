import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ChatSessionsStore, relativeDayLabel } from './chat-sessions.store';
import { ChatService } from './chat.service';
import { ChatThread } from './chat.model';

function thread(id: string, updated = '2026-08-05T12:00:00.000Z'): ChatThread {
  return { thread_id: id, title: `conversación ${id}`, created_at: updated, updated_at: updated };
}

describe('ChatSessionsStore', () => {
  function build(
    listThreads: ReturnType<typeof vi.fn>,
    renameThread: ReturnType<typeof vi.fn> = vi.fn(),
    deleteThread: ReturnType<typeof vi.fn> = vi.fn(),
  ): ChatSessionsStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ChatService, useValue: { listThreads, renameThread, deleteThread } }],
    });
    return TestBed.inject(ChatSessionsStore);
  }

  it('starts empty and only loads on demand', () => {
    const listThreads = vi.fn().mockReturnValue(of([thread('a')]));
    const store = build(listThreads);

    expect(store.threads()).toEqual([]);
    expect(listThreads).not.toHaveBeenCalled();
  });

  it('publishes the threads it loads', () => {
    const store = build(vi.fn().mockReturnValue(of([thread('a'), thread('b')])));

    store.refresh();

    expect(store.threads().map((t) => t.thread_id)).toEqual(['a', 'b']);
    expect(store.loading()).toBe(false);
  });

  it('survives a failing request instead of taking the screen down', () => {
    // El chat en el que el estudiante está escribiendo funciona igual sin
    // la lista del sidebar.
    const store = build(vi.fn().mockReturnValue(throwError(() => new Error('down'))));

    store.refresh();

    expect(store.threads()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  describe('renaming', () => {
    /** El agente recorta y colapsa, así que puede devolver otro texto. */
    function renombrada(id: string, title: string): ChatThread {
      return { ...thread(id), title };
    }

    it('shows the new name before the agent answers', () => {
      // Renombrar es un gesto pequeño y frecuente; esperar a que vuelva un
      // PATCH para ver la letra que acabas de escribir se siente roto.
      let responder: (t: ChatThread) => void = () => undefined;
      const rename = vi.fn(
        () =>
          new Observable<ChatThread>((subscriber) => {
            responder = (t) => {
              subscriber.next(t);
              subscriber.complete();
            };
          }),
      );
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), rename);
      store.refresh();

      store.rename('a', 'Becas y costos');

      expect(store.threads()[0].title).toBe('Becas y costos');
      responder(renombrada('a', 'Becas y costos'));
    });

    it('keeps what the agent stored, not what was typed', () => {
      // Quien recorta y colapsa es el agente: enseñar lo escrito dejaria la
      // pantalla diciendo algo distinto de lo que quedo guardado.
      const rename = vi.fn().mockReturnValue(of(renombrada('a', 'recortado por el agente')));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), rename);
      store.refresh();

      store.rename('a', '   recortado   por  el agente   ');

      expect(store.threads()[0].title).toBe('recortado por el agente');
    });

    it('only touches the conversation that was renamed', () => {
      const rename = vi.fn().mockReturnValue(of(renombrada('a', 'nuevo')));
      const store = build(vi.fn().mockReturnValue(of([thread('a'), thread('b')])), rename);
      store.refresh();

      store.rename('a', 'nuevo');

      expect(store.threads().map((t) => t.title)).toEqual(['nuevo', 'conversación b']);
    });

    it('puts the old name back when it fails', () => {
      const rename = vi.fn().mockReturnValue(throwError(() => new Error('down')));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), rename);
      store.refresh();

      store.rename('a', 'no va a cuajar');

      expect(store.threads()[0].title).toBe('conversación a');
    });

    it('says so, instead of letting the name change back on its own', () => {
      // Un nombre que vuelve solo a lo que era, sin explicacion, parece un
      // fallo de la aplicacion.
      const rename = vi.fn().mockReturnValue(throwError(() => new Error('down')));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), rename);
      store.refresh();

      store.rename('a', 'no va a cuajar');

      expect(store.renameError()).toContain('No se pudo cambiar el nombre');
    });

    it('clears an earlier failure when trying again', () => {
      const rename = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('down')))
        .mockReturnValueOnce(of(renombrada('a', 'a la segunda')));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), rename);
      store.refresh();
      store.rename('a', 'primera');

      store.rename('a', 'a la segunda');

      expect(store.renameError()).toBeNull();
      expect(store.threads()[0].title).toBe('a la segunda');
    });
  });

  describe('deleting', () => {
    it('takes the row out before the agent answers', () => {
      // Esperar al 204 para ver desaparecer lo que acabas de borrar se siente
      // roto, igual que en el renombrado.
      let responder: () => void = () => undefined;
      const borrar = vi.fn(
        () =>
          new Observable<void>((subscriber) => {
            responder = () => {
              subscriber.next();
              subscriber.complete();
            };
          }),
      );
      const store = build(vi.fn().mockReturnValue(of([thread('a'), thread('b')])), vi.fn(), borrar);
      store.refresh();

      store.delete('a');

      expect(store.threads().map((t) => t.thread_id)).toEqual(['b']);
      responder();
    });

    it('asks the agent again once it is done', () => {
      // El indice lo ordena el agente; volver a pedirlo es lo que garantiza
      // que se ve lo que quedo guardado y no lo que esta pantalla dedujo.
      const listThreads = vi
        .fn()
        .mockReturnValueOnce(of([thread('a'), thread('b')]))
        .mockReturnValueOnce(of([thread('b')]));
      const store = build(listThreads, vi.fn(), vi.fn().mockReturnValue(of(undefined)));
      store.refresh();

      store.delete('a');

      expect(listThreads).toHaveBeenCalledTimes(2);
      expect(store.threads().map((t) => t.thread_id)).toEqual(['b']);
    });

    it('only removes the conversation it was asked to', () => {
      // El borrado se deja sin contestar a proposito: lo que se mira aqui es
      // el paso optimista. Si contestara, el `refresh()` de despues repondria
      // la lista del agente y estariamos comprobando el mock, no el store.
      const store = build(
        vi.fn().mockReturnValue(of([thread('a'), thread('b'), thread('c')])),
        vi.fn(),
        vi.fn().mockReturnValue(new Observable<void>(() => undefined)),
      );
      store.refresh();

      store.delete('b');

      expect(store.threads().map((t) => t.thread_id)).toEqual(['a', 'c']);
    });

    it('puts the conversation back when it fails', () => {
      const borrar = vi.fn().mockReturnValue(throwError(() => new Error('down')));
      const store = build(vi.fn().mockReturnValue(of([thread('a'), thread('b')])), vi.fn(), borrar);
      store.refresh();

      store.delete('a');

      expect(store.threads().map((t) => t.thread_id)).toEqual(['a', 'b']);
    });

    it('says so, instead of letting the conversation come back on its own', () => {
      const borrar = vi.fn().mockReturnValue(throwError(() => new Error('down')));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), vi.fn(), borrar);
      store.refresh();

      store.delete('a');

      expect(store.deleteError()).toContain('No se pudo borrar');
    });

    it('clears an earlier failure when trying again', () => {
      const borrar = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('down')))
        .mockReturnValueOnce(of(undefined));
      const store = build(vi.fn().mockReturnValue(of([thread('a')])), vi.fn(), borrar);
      store.refresh();
      store.delete('a');

      store.delete('a');

      expect(store.deleteError()).toBeNull();
    });

    it('keeps the two failures apart', () => {
      // Borrar y renombrar pueden fallar seguidos, y un aviso no debe tapar
      // al otro.
      const store = build(
        vi.fn().mockReturnValue(of([thread('a')])),
        vi.fn().mockReturnValue(throwError(() => new Error('down'))),
        vi.fn().mockReturnValue(throwError(() => new Error('down'))),
      );
      store.refresh();

      store.rename('a', 'no va a cuajar');
      store.delete('a');

      expect(store.renameError()).toContain('No se pudo cambiar el nombre');
      expect(store.deleteError()).toContain('No se pudo borrar');
    });
  });
});

describe('relativeDayLabel', () => {
  const now = new Date('2026-08-05T10:00:00');

  it('says "Hoy" for the same calendar day', () => {
    expect(relativeDayLabel('2026-08-05T01:00:00', now)).toBe('Hoy');
  });

  it('says "Ayer" across midnight, not "hace unas horas"', () => {
    // Un mensaje de las 23:50 de ayer es "Ayer" a las 00:10, aunque hayan
    // pasado 20 minutos. Por eso se compara por día calendario.
    expect(relativeDayLabel('2026-08-04T23:50:00', new Date('2026-08-05T00:10:00'))).toBe('Ayer');
  });

  it('counts days for the recent past', () => {
    expect(relativeDayLabel('2026-08-02T10:00:00', now)).toBe('Hace 3 días');
  });

  it('falls back to a date once it stops being useful', () => {
    expect(relativeDayLabel('2026-01-15T10:00:00', now)).toMatch(/15/);
  });

  it('returns nothing for an unparseable timestamp', () => {
    expect(relativeDayLabel('no es una fecha', now)).toBe('');
  });
});
