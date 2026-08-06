import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ChatSessionsStore, relativeDayLabel } from './chat-sessions.store';
import { ChatService } from './chat.service';
import { ChatThread } from './chat.model';

function thread(id: string, updated = '2026-08-05T12:00:00.000Z'): ChatThread {
  return { thread_id: id, title: `conversación ${id}`, created_at: updated, updated_at: updated };
}

describe('ChatSessionsStore', () => {
  function build(listThreads: ReturnType<typeof vi.fn>): ChatSessionsStore {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ChatService, useValue: { listThreads } }],
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
