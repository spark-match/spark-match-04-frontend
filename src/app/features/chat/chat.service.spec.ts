import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { ChatService } from './chat.service';
import { environment } from '../../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChatService);
  });

  describe('startSession (mocks enabled)', () => {
    it('returns a mock session with a greeting message', async () => {
      expect(environment.useMocks).toBe(true);

      const session = await firstValueFrom(service.startSession(null));

      expect(session.id).toBe('mock-session-1');
      expect(session.filters).toBeNull();
      expect(session.messages.length).toBe(1);
      expect(session.messages[0].role).toBe('ai');
      expect(session.messages[0].text).toContain('orientador vocacional');
    });

    it('passes the filters through to the session', async () => {
      const filters = {
        region: 'Lima',
        institutionType: 'publica',
        academicType: 'ingenieria',
        budget: 6000,
      } as never;

      const session = await firstValueFrom(service.startSession(filters));

      expect(session.filters).toEqual(filters);
    });
  });

  describe('sendMessage (mocks enabled)', () => {
    it('returns a mock reply that rotates through MOCK_AI_REPLIES', async () => {
      const first = await firstValueFrom(service.sendMessage('s1', 'hola'));
      expect(first.role).toBe('ai');
      expect(first.isFinalRecommendation).toBeFalsy();

      const second = await firstValueFrom(service.sendMessage('s1', 'otra'));
      expect(second.isFinalRecommendation).toBeFalsy();

      const third = await firstValueFrom(service.sendMessage('s1', 'otra más'));
      expect(third.isFinalRecommendation).toBe(true);
    });

    it('keeps rotating after the array length', async () => {
      await firstValueFrom(service.sendMessage('s1', 'a'));
      await firstValueFrom(service.sendMessage('s1', 'b'));
      await firstValueFrom(service.sendMessage('s1', 'c'));

      const fourth = await firstValueFrom(service.sendMessage('s1', 'd'));
      expect(fourth.isFinalRecommendation).toBeFalsy();
    });
  });

  describe('submitRecommendationRating (mocks enabled)', () => {
    it('resolves without a value when mocks are enabled', async () => {
      const result = await firstValueFrom(service.submitRecommendationRating('s1', 5));
      expect(result).toBeUndefined();
    });
  });
});