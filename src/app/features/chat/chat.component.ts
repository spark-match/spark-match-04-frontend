import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../core/services/chat.service';
import { FiltersService } from '../../core/services/filters.service';
import { ChatMessage } from '../../core/models/chat.model';

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
      this.sending.set(false);
    });
  }

  timeLabel(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
