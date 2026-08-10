import { Service, inject, signal } from '@angular/core';
import { ChatService } from './chat.service';
import { ChatThread } from './chat.model';

/**
 * La lista de conversaciones, compartida entre el sidebar y el chat.
 *
 * Los dos necesitan la misma verdad y ninguno es dueño de ella: el sidebar la
 * pinta, y el chat la invalida al terminar un turno (una conversación nueva
 * no existe en el índice hasta que se manda el primer mensaje, y una vieja
 * cambia de posición cuando se retoma). Pasarla por `@Input`/`@Output` entre
 * dos ramas distintas del árbol sería peor.
 */
@Service()
export class ChatSessionsStore {
  private readonly chatService = inject(ChatService);

  readonly threads = signal<ChatThread[]>([]);
  readonly loading = signal(false);
  /** Lo que se le dice al estudiante cuando un renombrado no llegó. */
  readonly renameError = signal<string | null>(null);

  /**
   * Cambia el nombre de una conversación.
   *
   * El nombre nuevo se pinta antes de que el agente conteste. Renombrar es un
   * gesto pequeño y frecuente, y esperar medio segundo a que vuelva un PATCH
   * para ver la letra que acabas de escribir se siente roto.
   *
   * A cambio hay que deshacerlo bien si falla: se guarda la lista de antes y
   * se restaura entera. Y se avisa — un nombre que vuelve solo a lo que era,
   * sin explicación, parece un fallo de la aplicación.
   */
  rename(threadId: string, title: string): void {
    const anterior = this.threads();
    this.renameError.set(null);
    this.threads.update((lista) =>
      lista.map((thread) => (thread.thread_id === threadId ? { ...thread, title } : thread)),
    );

    this.chatService.renameThread(threadId, title).subscribe({
      // Se toma la conversación que devuelve el agente y no la de aquí: es
      // él quien recorta y colapsa el título, así que lo que se enseña tiene
      // que ser lo que quedó guardado, no lo que se escribió.
      next: (renombrada) =>
        this.threads.update((lista) =>
          lista.map((thread) => (thread.thread_id === threadId ? renombrada : thread)),
        ),
      error: () => {
        this.threads.set(anterior);
        this.renameError.set('No se pudo cambiar el nombre. Inténtalo de nuevo.');
      },
    });
  }

  refresh(): void {
    this.loading.set(true);
    this.chatService.listThreads().subscribe({
      next: (threads) => {
        this.threads.set(threads);
        this.loading.set(false);
      },
      // Que no cargue la lista no puede tumbar la pantalla: el chat en el
      // que el estudiante está escribiendo funciona igual sin sidebar.
      error: () => {
        this.threads.set([]);
        this.loading.set(false);
      },
    });
  }
}

/**
 * "Hoy", "Ayer", "Hace 3 días".
 *
 * Se compara por día calendario y no por horas transcurridas: un mensaje de
 * las 23:50 de ayer es "Ayer" a las 00:10, no "Hace 20 minutos".
 */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return then.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}
