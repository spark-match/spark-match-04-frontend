import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { SidebarComponent } from './sidebar.component';
import { ChatSessionsStore } from '../../features/chat/chat-sessions.store';
import { ChatService } from '../../features/chat/chat.service';
import { ChatThread } from '../../features/chat/chat.model';

const THREADS: ChatThread[] = [
  {
    thread_id: 'abc-1',
    title: 'Ingeniería vs Medicina',
    created_at: '2026-08-05T10:00:00.000Z',
    updated_at: '2026-08-05T10:00:00.000Z',
  },
];

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let sessionsStub: {
    threads: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let chatStub: { startNewThread: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sessionsStub = { threads: signal(THREADS), loading: signal(false), refresh: vi.fn() };
    chatStub = { startNewThread: vi.fn().mockReturnValue('nuevo-id') };

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: ChatSessionsStore, useValue: sessionsStub },
        { provide: ChatService, useValue: chatStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('exposes nav as a vertical toolbar for ARIA', () => {
    const nav = fixture.nativeElement.querySelector('.sidebar__nav') as HTMLElement;
    expect(nav).toBeTruthy();
    expect(nav.getAttribute('aria-orientation')).toBe('vertical');
    expect(nav.getAttribute('aria-label')).toBe('Navegación principal');
    expect(nav.getAttribute('role')).toBe('toolbar');
  });

  it('marks each nav item as a toolbar widget', () => {
    const navItems = fixture.nativeElement.querySelectorAll('.sidebar__nav-item');
    expect(navItems.length).toBe(5);
    navItems.forEach((item: Element) => {
      expect(item.tagName.toLowerCase()).toBe('a');
      expect(item.getAttribute('ngtoolbarwidget')).not.toBeNull();
    });
  });

  it('toggles collapsed state when collapse button is clicked', () => {
    expect(component.collapsed()).toBe(false);
    component.toggleCollapsed();
    expect(component.collapsed()).toBe(true);
  });

  it('toggles admin mode when admin toggle handler is called', () => {
    expect(component.adminMode()).toBe(false);
    component.toggleAdminMode();
    expect(component.adminMode()).toBe(true);
  });

  describe('recent conversations', () => {
    it('asks for the real list on init', () => {
      expect(sessionsStub.refresh).toHaveBeenCalled();
    });

    it('renders the conversations the user actually has', () => {
      // Antes esto era una lista hardcodeada de cuatro títulos inventados.
      const items = fixture.nativeElement.querySelectorAll('.sidebar__recent-item');

      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('Ingeniería vs Medicina');
    });

    it('opens the conversation that was clicked', () => {
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.openChat('abc-1');

      expect(navigate).toHaveBeenCalledWith(['/assessment', 'abc-1']);
    });

    it('says so when there are no conversations yet', () => {
      sessionsStub.threads.set([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Aún no tienes conversaciones');
    });
  });

  describe('new chat', () => {
    it('creates an id and navigates to it', () => {
      // El id se crea aquí para que la URL ya lo lleve: así recargar sobre
      // esa dirección sigue en la conversación nueva y no crea otra.
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      component.newChat();

      expect(chatStub.startNewThread).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(['/assessment', 'nuevo-id']);
    });
  });
});
