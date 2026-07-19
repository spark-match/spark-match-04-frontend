import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService } from './chat.service';
import { FiltersService } from '../filters/filters.service';
import { ChatMessage } from './chat.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
})
export class ChatComponent implements OnInit {
  private chatService = inject(ChatService);
  private filtersService = inject(FiltersService);

  private sessionId = '';
  draft = '';
  sending = signal(false);
  loadingSession = signal(true);
  messages = signal<ChatMessage[]>([]);
  showRecommendationRating = signal(false);
  rating = signal(0);
  submittingRating = signal(false);
  ratingSubmitted = signal(false);

  get profileSummary(): string {
    const filters = this.filtersService.currentFilters();
    if (!filters) return 'Sin filtros configurados';
    const institution =
      filters.institutionType === 'ambas' ? 'Pública/Privada' : capitalize(filters.institutionType);
    return `${filters.region} · ${institution}`;
  }

  ngOnInit(): void {
    const filters = this.filtersService.currentFilters();
    this.chatService.startSession(filters).subscribe((session) => {
      this.sessionId = session.id;
      this.messages.set(session.messages);
      this.loadingSession.set(false);
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text) return;

    this.messages.update((msgs) => [
      ...msgs,
      { id: crypto.randomUUID(), role: 'user', text, timestamp: new Date().toISOString() },
    ]);
    this.draft = '';
    this.sending.set(true);

    this.chatService.sendMessage(this.sessionId, text).subscribe((reply) => {
      this.messages.update((msgs) => [...msgs, reply]);
      if (reply.isFinalRecommendation) {
        this.showRecommendationRating.set(true);
      }
      this.sending.set(false);
    });
  }

  rateRecommendation(rating: number): void {
    if (this.submittingRating() || this.ratingSubmitted()) return;

    this.rating.set(rating);
    this.submittingRating.set(true);
    this.chatService.submitRecommendationRating(this.sessionId, rating).subscribe({
      next: () => {
        this.ratingSubmitted.set(true);
        this.submittingRating.set(false);
      },
      error: () => this.submittingRating.set(false),
    });
  }

  dismissRecommendationRating(): void {
    this.showRecommendationRating.set(false);
  }

  timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
