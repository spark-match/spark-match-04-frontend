import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { ChatMessage, ChatSession } from './chat.model';

const buildSession = (): ChatSession => ({
  id: 'session-1',
  filters: null,
  messages: [
    { id: 'm1', role: 'ai', text: '¡Hola! ¿En qué puedo ayudarte?', timestamp: '2026-07-26T12:00:00.000Z' },
  ],
});

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let startSessionMock: ReturnType<typeof vi.fn>;
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let submitRatingMock: ReturnType<typeof vi.fn>;
  let filtersStub: { currentFilters: ReturnType<typeof signal> };

  beforeEach(async () => {
    startSessionMock = vi.fn().mockReturnValue(of(buildSession())) as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock = vi.fn().mockImplementation((_id: string, text: string) =>
      of({
        id: 'reply-1',
        role: 'ai' as const,
        text: `Respuesta a: ${text}`,
        timestamp: '2026-07-26T12:01:00.000Z',
        isFinalRecommendation: false,
      }),
    ) as unknown as ReturnType<typeof vi.fn>;
    submitRatingMock = vi.fn().mockReturnValue(of({ ok: true })) as unknown as ReturnType<typeof vi.fn>;
    filtersStub = { currentFilters: signal(null) };

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        provideRouter([]),
        { provide: ChatService, useValue: { startSession: startSessionMock, sendMessage: sendMessageMock, submitRecommendationRating: submitRatingMock } },
        { provide: FiltersService, useValue: filtersStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('starts the chat session on init and seeds messages', () => {
    expect(startSessionMock).toHaveBeenCalledOnce();
    expect(component.loadingSession()).toBe(false);
    expect(component.messages().length).toBe(1);
    expect(component.messages()[0].text).toContain('Hola');
  });

  it('reports "Sin filtros configurados" when no filters are set', () => {
    filtersStub.currentFilters.set(null);
    expect(component.profileSummary).toBe('Sin filtros configurados');
  });

  it('formats the profile summary with region and capitalized institution', () => {
    filtersStub.currentFilters.set({
      region: 'Arequipa',
      institutionType: 'privada',
      academicType: 'ingenieria',
      budget: 5000,
    } as never);
    expect(component.profileSummary).toBe('Arequipa · Privada');
  });

  it('uses "Pública/Privada" when institutionType is "ambas"', () => {
    filtersStub.currentFilters.set({
      region: 'Lima',
      institutionType: 'ambas',
      academicType: 'ingenieria',
      budget: 5000,
    } as never);
    expect(component.profileSummary).toBe('Lima · Pública/Privada');
  });

  it('does nothing when send is called with an empty draft', () => {
    component.draft = '   ';
    component.send();
    expect(component.messages().length).toBe(1);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('appends the user message, clears the draft, and requests a reply', () => {
    component.draft = '¿Qué carrera me conviene?';
    component.send();

    // 3 messages: initial AI + user + reply (reply is synchronous via of())
    expect(component.messages().length).toBe(3);
    expect(component.messages()[1].role).toBe('user');
    expect(component.messages()[1].text).toBe('¿Qué carrera me conviene?');
    expect(component.draft).toBe('');
    expect(sendMessageMock).toHaveBeenCalledOnce();
    expect(component.messages()[2].text).toContain('Respuesta a:');
  });

  it('shows the rating modal when the reply is a final recommendation', () => {
    sendMessageMock.mockReturnValueOnce(
      of({
        id: 'r',
        role: 'ai',
        text: 'Te recomiendo Ingeniería',
        timestamp: '2026-07-26T12:01:00.000Z',
        isFinalRecommendation: true,
      } as ChatMessage),
    );

    component.draft = 'Dame tu recomendación';
    component.send();

    expect(component.showRecommendationRating()).toBe(true);
  });

  it('submits the rating and marks the recommendation as rated', () => {
    component.showRecommendationRating.set(true);
    component.rateRecommendation(4);

    expect(submitRatingMock).toHaveBeenCalledWith('session-1', 4);
    expect(component.rating()).toBe(4);
    expect(component.ratingSubmitted()).toBe(true);
  });

  it('ignores repeated ratings once submitted', () => {
    component.showRecommendationRating.set(true);
    component.rateRecommendation(5);
    component.rateRecommendation(1);

    expect(submitRatingMock).toHaveBeenCalledOnce();
    expect(component.rating()).toBe(5);
  });

  it('resets submittingRating on error', () => {
    submitRatingMock.mockReturnValueOnce(throwError(() => new Error('boom')));

    component.showRecommendationRating.set(true);
    component.rateRecommendation(3);

    expect(component.submittingRating()).toBe(false);
  });

  it('dismisses the rating modal without sending', () => {
    component.showRecommendationRating.set(true);
    component.dismissRecommendationRating();

    expect(component.showRecommendationRating()).toBe(false);
    expect(submitRatingMock).not.toHaveBeenCalled();
  });

  it('formats timestamps in es-PE locale', () => {
    const label = component.timeLabel('2026-07-26T15:30:00.000Z');
    // es-PE renders "10:30 a. m." / "03:30 p. m." (note: lowercase with dots)
    expect(label).toMatch(/\d{1,2}:\d{2}/);
    expect(label).toBeTruthy();
  });

  it('shows the loading state while the session is being fetched', () => {
    const fresh = TestBed.createComponent(ChatComponent);
    expect(fresh.componentInstance.loadingSession()).toBe(true);
  });
});