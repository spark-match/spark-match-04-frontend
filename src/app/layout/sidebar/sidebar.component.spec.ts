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
    deleteError: ReturnType<typeof signal>;
    refresh: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let chatStub: {
    startNewThread: ReturnType<typeof vi.fn>;
    currentThreadId: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    sessionsStub = {
      threads: signal(THREADS),
      loading: signal(false),
      renameError: signal(null),
      deleteError: signal(null),
      refresh: vi.fn(),
      rename: vi.fn(),
      delete: vi.fn(),
    };
    chatStub = {
      startNewThread: vi.fn().mockReturnValue('nuevo-id'),
      currentThreadId: vi.fn().mockReturnValue('abc-1'),
    };

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

  /*
   * Borrar no se deshace, ni aqui ni en el agente: se lleva los mensajes, la
   * entrada del indice y el registro de dueño. De ahi que se pregunte antes,
   * y que la pregunta se lea en el sitio de la fila que va a desaparecer.
   */
  describe('deleting a conversation', () => {
    function laFilaDeConfirmacion(): HTMLElement | null {
      return fixture.nativeElement.querySelector('.sidebar__recent-confirm');
    }

    function pedirBorrado(): void {
      component.pedirConfirmacionDeBorrado('abc-1');
      fixture.detectChanges();
    }

    it('has a visible, tabbable way in', () => {
      const boton = fixture.nativeElement.querySelector('.sidebar__recent-delete');

      expect(boton).not.toBeNull();
      expect(boton.getAttribute('aria-label')).toContain('Ingeniería vs Medicina');
    });

    it('asks before deleting anything', () => {
      pedirBorrado();

      expect(laFilaDeConfirmacion()).not.toBeNull();
      expect(sessionsStub.delete).not.toHaveBeenCalled();
    });

    it('names the conversation, because it took its place on screen', () => {
      // La pregunta sustituye a la fila, asi que el titulo deja de verse: si
      // no lo dijera ella, no lo diria nadie.
      pedirBorrado();

      expect(laFilaDeConfirmacion()?.textContent).toContain('Ingeniería vs Medicina');
    });

    it('groups the question with its buttons using a real element', () => {
      // `fieldset` y no un `div` con `role="group"`: mismo significado, sin
      // tener que anunciarlo con un atributo (Web:S6819).
      pedirBorrado();

      expect(laFilaDeConfirmacion()?.tagName).toBe('FIELDSET');
      expect(laFilaDeConfirmacion()?.querySelector('legend')).not.toBeNull();
    });

    it('deletes once confirmed', () => {
      pedirBorrado();

      component.confirmarBorrado('abc-1');

      expect(sessionsStub.delete).toHaveBeenCalledWith('abc-1');
    });

    it('cancelling leaves the conversation alone', () => {
      pedirBorrado();

      component.cancelarBorrado();
      fixture.detectChanges();

      expect(laFilaDeConfirmacion()).toBeNull();
      expect(sessionsStub.delete).not.toHaveBeenCalled();
    });

    it('closes an open rename instead of stacking both on one row', () => {
      // El `blur` del boton de confirmar guardaria un renombrado que nadie
      // pidio si el input siguiera abierto detras de la pregunta.
      component.empezarARenombrar('abc-1');

      pedirBorrado();

      expect(component.renombrando()).toBeNull();
    });

    /**
     * Coloca al estudiante en una pantalla.
     *
     * Se finge la URL en vez de navegar de verdad: el `provideRouter([])` de
     * arriba no tiene rutas, asi que un `navigate` real solo probaria que el
     * router rechaza direcciones que no existen. Lo que decide aqui es la URL,
     * que es exactamente lo que lee el componente.
     */
    function estandoEn(url: string): ReturnType<typeof vi.spyOn> {
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue(url);
      return vi.spyOn(router, 'navigate').mockResolvedValue(true);
    }

    it('opens a new chat when the deleted one was on screen', () => {
      // Quedarse en `/assessment/<id>` de algo que ya no existe deja mensajes
      // que no se pueden continuar: el siguiente turno iria a un hilo que el
      // agente ya no reconoce.
      const navigate = estandoEn('/assessment/abc-1');

      component.confirmarBorrado('abc-1');

      expect(navigate).toHaveBeenCalledWith(['/assessment', 'nuevo-id']);
    });

    it('stays put when the deleted one was not the open one', () => {
      const navigate = estandoEn('/assessment/otra-conversacion');

      component.confirmarBorrado('abc-1');

      expect(sessionsStub.delete).toHaveBeenCalledWith('abc-1');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does not drag the student to the chat from another screen', () => {
      // Borrar una conversacion vieja desde el perfil no deberia moverte.
      const navigate = estandoEn('/profile');

      component.confirmarBorrado('abc-1');

      expect(navigate).not.toHaveBeenCalled();
    });

    it('follows the stored conversation when the URL carries no id', () => {
      // En `/assessment` a secas el chat abre el que tenga guardado, asi que
      // ese es el que esta en pantalla.
      const navigate = estandoEn('/assessment');

      component.confirmarBorrado('abc-1');

      expect(chatStub.currentThreadId).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/assessment', 'nuevo-id']);
    });

    it('shows a failure instead of letting the conversation come back on its own', () => {
      sessionsStub.deleteError.set('No se pudo borrar la conversación. Inténtalo de nuevo.');
      fixture.detectChanges();

      const aviso = fixture.nativeElement.querySelector('.sidebar__recent-error[role="alert"]');
      expect(aviso.textContent).toContain('No se pudo borrar');
    });

    it('clears an earlier failure when asking again', () => {
      sessionsStub.deleteError.set('No se pudo borrar la conversación. Inténtalo de nuevo.');

      pedirBorrado();

      expect(sessionsStub.deleteError()).toBeNull();
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
