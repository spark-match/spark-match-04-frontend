/**
 * Contrato INVENTADO para el chat de orientación (mockup "Orientador IA").
 * Cuando el backend conecte con Amazon Bedrock, probablemente el mensaje del
 * asistente venga por streaming (SSE) en vez de un único ChatMessage; en ese
 * caso solo cambia la implementación interna de ChatService.sendMessage().
 */
import { OrientationFilters } from './filters.model';

export type ChatRole = 'ai' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** ISO 8601 */
  timestamp: string;
}

export interface ChatSession {
  id: string;
  filters: OrientationFilters | null;
  messages: ChatMessage[];
}
