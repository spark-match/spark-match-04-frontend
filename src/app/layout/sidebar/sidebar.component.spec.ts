import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { SidebarComponent } from './sidebar.component';
import { ChatSessionsStore } from '../../features/chat/chat-sessions.store';
import { ChatService } from '../../features/chat/chat.service';
import { ChatThread } from '../../features/chat/chat.model';
import { AuthService } from '../../core/auth/auth.service';

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
    renameError: ReturnType<typeof signal>;
    refresh: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
  };
  let chatStub: { startNewThread: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    sessionsStub = {
      threads: signal(THREADS),
      loading: signal(false),
      renameError: signal(null),
      refresh: vi.fn(),
      rename: vi.fn(),
    };
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

  // Ojo: esta prueba llama al metodo y no mira el DOM, asi que pasaba igual
  // cuando el panel se le enseñaba a cualquiera. Las de abajo comprueban lo
  // que de verdad se pinta.
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

  /**
   * El título que pone el agente es el primer mensaje recortado: sirve para
   * reconocer una conversación recién tenida y no para encontrarla dentro de
   * tres semanas entre otras diez que empiezan igual.
   */
  describe('renaming a conversation', () => {
    function elInput(): HTMLInputElement | null {
      return fixture.nativeElement.querySelector('.sidebar__recent-input');
    }

    function editar(): HTMLInputElement {
      component.empezarARenombrar('abc-1');
      fixture.detectChanges();
      const input = elInput();
      if (!input) throw new Error('no se abrió el campo de edición');
      return input;
    }

    it('opens an input in place instead of a dialog', () => {
      const input = editar();

      expect(input.value).toBe('Ingeniería vs Medicina');
    });

    it('caps the input at the same length the agent does', () => {
      // Escribir treinta caracteres de mas para que te los rechacen al
      // enviar es peor que no dejarte escribirlos.
      expect(editar().getAttribute('maxlength')).toBe('60');
    });

    it('has a visible way in, not just a double click', () => {
      // El doble clic no se descubre solo y quien navega con teclado no lo
      // tiene.
      const boton = fixture.nativeElement.querySelector('.sidebar__recent-rename');

      expect(boton).not.toBeNull();
      expect(boton.getAttribute('aria-label')).toContain('Ingeniería vs Medicina');
    });

    it('saves the new name', () => {
      editar();

      component.confirmarRenombrado('abc-1', 'Becas y costos');

      expect(sessionsStub.rename).toHaveBeenCalledWith('abc-1', 'Becas y costos');
    });

    it('closes the input once saved', () => {
      editar();

      component.confirmarRenombrado('abc-1', 'Becas y costos');
      fixture.detectChanges();

      expect(elInput()).toBeNull();
    });

    it('trims what was typed', () => {
      editar();

      component.confirmarRenombrado('abc-1', '  Becas y costos  ');

      expect(sessionsStub.rename).toHaveBeenCalledWith('abc-1', 'Becas y costos');
    });

    it('an empty name means «I changed my mind», not «call it nothing»', () => {
      editar();

      component.confirmarRenombrado('abc-1', '   ');

      expect(sessionsStub.rename).not.toHaveBeenCalled();
    });

    it('does not send a rename that changes nothing', () => {
      editar();

      component.confirmarRenombrado('abc-1', 'Ingeniería vs Medicina');

      expect(sessionsStub.rename).not.toHaveBeenCalled();
    });

    it('escape discards it', () => {
      editar();

      component.cancelarRenombrado();
      fixture.detectChanges();

      expect(elInput()).toBeNull();
      expect(sessionsStub.rename).not.toHaveBeenCalled();
    });

    it('the blur that escape causes does not save what was discarded', () => {
      // Quitar el input de la pantalla dispara un `blur`, y el `blur`
      // guarda. Sin la guarda, Escape acabaria guardando justo lo que se
      // queria descartar.
      editar();

      component.cancelarRenombrado();
      component.confirmarRenombrado('abc-1', 'lo que se estaba escribiendo');

      expect(sessionsStub.rename).not.toHaveBeenCalled();
    });

    it('does not save twice when enter is followed by a blur', () => {
      editar();

      component.confirmarRenombrado('abc-1', 'Becas y costos');
      component.confirmarRenombrado('abc-1', 'Becas y costos');

      expect(sessionsStub.rename).toHaveBeenCalledOnce();
    });

    it('shows a failure instead of letting the name change back on its own', () => {
      sessionsStub.renameError.set('No se pudo cambiar el nombre. Inténtalo de nuevo.');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('No se pudo cambiar el nombre');
    });

    it('clears an earlier failure when starting again', () => {
      sessionsStub.renameError.set('No se pudo cambiar el nombre. Inténtalo de nuevo.');

      component.empezarARenombrar('abc-1');

      expect(sessionsStub.renameError()).toBeNull();
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

  /*
   * El panel de administración no tenía ninguna comprobación de rol: la casilla
   * la veía cualquiera y, al marcarla, aparecía un cuadro de MLOps con versiones
   * de prompt y fórmulas de scoring que no existen en ningún repositorio.
   *
   * Se comprueba sobre el DOM y no sobre el signal: un estudiante no debe ver
   * ni la casilla. Y se cubre el caso sin rol, que es el que ocurre con sesiones
   * guardadas antes de que el backend lo enviara.
   */
  describe('panel de administración', () => {
    async function montarCon(isAdmin: boolean) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [SidebarComponent],
        providers: [
          provideRouter([]),
          { provide: ChatSessionsStore, useValue: sessionsStub },
          { provide: ChatService, useValue: chatStub },
          {
            provide: AuthService,
            useValue: {
              user: signal({ id: 'x', email: 'a@b.com', fullName: 'A B' }),
              isAdmin: signal(isAdmin),
            },
          },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(SidebarComponent);
      f.detectChanges();
      return f.nativeElement as HTMLElement;
    }

    it('no se lo enseña a un estudiante', async () => {
      const html = await montarCon(false);
      expect(html.querySelector('.sidebar__admin')).toBeNull();
      expect(html.textContent).not.toContain('Modo admin');
    });

    it('se lo enseña a un admin', async () => {
      const html = await montarCon(true);
      expect(html.querySelector('.sidebar__admin')).not.toBeNull();
      expect(html.textContent).toContain('Modo admin');
    });
  });
});
