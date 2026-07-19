import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ChatMessage, ChatSession } from './chat.model';
import { OrientationFilters } from '../filters/filters.model';

// Respuestas mock rotativas, solo para que el chat se sienta vivo mientras no hay backend.
const MOCK_AI_REPLIES: Array<{ text: string; isFinalRecommendation?: boolean }> = [
  { text: 'Estoy comparando tu perfil con las carreras de Ponte en Carrera que más se ajustan a tu presupuesto y región.' },
  { text: 'Según los datos disponibles, esa opción tiene buena empleabilidad. Estoy terminando tu propuesta personalizada.' },
  {
    text: 'Mi recomendación principal es Ingeniería de Sistemas e Informática, seguida de Ciencia de Datos e Ingeniería Biomédica. Estas opciones combinan alta compatibilidad con tu perfil, empleabilidad y presupuesto.',
    isFinalRecommendation: true,
  },
];

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/chat`;
  private replyIndex = 0;

  /** Crea una sesión de chat, opcionalmente precargada con los filtros de /filters. */
  startSession(filters: OrientationFilters | null): Observable<ChatSession> {
    if (environment.useMocks) {
      const session: ChatSession = {
        id: 'mock-session-1',
        filters,
        messages: [
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: '¡Hola! Soy tu orientador vocacional con IA. Usamos datos oficiales de Ponte en Carrera del Ministerio de Educación para darte recomendaciones basadas en el mercado laboral real peruano. ¿Por dónde empezamos?',
            timestamp: new Date().toISOString(),
          },
        ],
      };
      return of(session).pipe(delay(400));
    }
    return this.http.post<ChatSession>(`${this.base}/sessions`, { filters });
  }

  /** Envía un mensaje del usuario y devuelve la respuesta del asistente. */
  sendMessage(sessionId: string, text: string): Observable<ChatMessage> {
    if (environment.useMocks) {
      const reply = MOCK_AI_REPLIES[this.replyIndex % MOCK_AI_REPLIES.length];
      this.replyIndex++;
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        text: reply.text,
        timestamp: new Date().toISOString(),
        isFinalRecommendation: reply.isFinalRecommendation,
      };
      return of(message).pipe(delay(900));
    }
    return this.http.post<ChatMessage>(`${this.base}/sessions/${sessionId}/messages`, { text });
  }

  /** Registra una única valoración de la recomendación final, de 1 a 5 estrellas. */
  submitRecommendationRating(sessionId: string, rating: number): Observable<void> {
    if (environment.useMocks) {
      return of(void 0).pipe(delay(200));
    }
    return this.http.post<void>(`${this.base}/sessions/${sessionId}/feedback`, { rating });
  }
}
