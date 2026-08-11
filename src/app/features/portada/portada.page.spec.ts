import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CANALES, canalesPublicables } from './contacto';
import { PortadaPage } from './portada.page';

/*
 * En local `environment.useMocks` va en true y `AuthService` fabrica una sesión
 * falsa nada más arrancar, así que la portada SIEMPRE se ve como si hubiera
 * sesión al abrirla con `ng serve`. La rama de visitante --que es justo la que
 * esta página existe para atender-- solo se puede ver desde aquí.
 */
function montar(conSesion: boolean): ComponentFixture<PortadaPage> {
  TestBed.configureTestingModule({
    imports: [PortadaPage],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: signal(conSesion) } },
    ],
  });
  const fixture = TestBed.createComponent(PortadaPage);
  fixture.detectChanges();
  return fixture;
}

function enlaces(fixture: ComponentFixture<PortadaPage>): { texto: string; href: string }[] {
  return Array.from(fixture.nativeElement.querySelectorAll('a')).map((a) => ({
    texto: (a as HTMLAnchorElement).textContent?.trim() ?? '',
    href: (a as HTMLAnchorElement).getAttribute('href') ?? '',
  }));
}

describe('PortadaPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  describe('quien llega sin cuenta', () => {
    it('ve las dos puertas: crear cuenta y entrar', () => {
      const anclas = enlaces(montar(false));

      expect(anclas.some((e) => e.href === '/auth/register')).toBe(true);
      expect(anclas.some((e) => e.href === '/auth/login')).toBe(true);
    });

    it('no ve ningún enlace al interior de la aplicación', () => {
      // Ofrecerle el panel a quien no ha entrado es mandarlo al guard y de ahí
      // al login, o sea dos saltos para acabar donde ya podía ir de un clic.
      const anclas = enlaces(montar(false));

      expect(anclas.filter((e) => e.href === '/home')).toEqual([]);
    });
  });

  describe('quien ya tiene sesión', () => {
    it('ve el panel en vez de la invitación a registrarse', () => {
      const anclas = enlaces(montar(true));

      expect(anclas.some((e) => e.href === '/home')).toBe(true);
      expect(anclas.filter((e) => e.href === '/auth/register')).toEqual([]);
    });

    /*
     * No se le redirige al panel. Aterrizar en una URL distinta de la que
     * tecleaste desconcierta más de lo que ahorra, y además la portada es una
     * página legítima que alguien con cuenta puede querer ver --para enseñarla,
     * por ejemplo--.
     */
    it('sigue viendo la portada, no se le echa de ella', () => {
      const fixture = montar(true);

      expect(fixture.nativeElement.querySelector('.hero__titulo')).toBeTruthy();
    });
  });

  describe('el contacto', () => {
    it('no pinta un canal que todavía no existe', () => {
      // Un enlace a una cuenta que no está abierta es peor que no ofrecer el
      // canal: quien lo pulsa se lleva un 404 con nuestro nombre encima.
      const canales = canalesPublicables([
        { etiqueta: 'Correo', detalle: 'a@b.pe', destino: 'mailto:a@b.pe', icono: 'correo' },
        { etiqueta: 'WhatsApp', detalle: 'Escríbenos', destino: '', icono: 'whatsapp' },
        { etiqueta: 'Instagram', detalle: '@x', destino: '   ', icono: 'instagram' },
      ]);

      expect(canales.map((c) => c.etiqueta)).toEqual(['Correo']);
    });

    it('los que se declaran con destino llegan a la página', () => {
      const publicables = canalesPublicables();
      const anclas = enlaces(montar(false));

      for (const canal of publicables) {
        expect(anclas.some((e) => e.href === canal.destino)).toBe(true);
      }
    });

    it('ningún canal declarado se queda sin etiqueta ni sin detalle', () => {
      // Los que aún no tienen destino se pintarán en cuanto lo tengan, y ese
      // día nadie va a volver a mirar si el texto estaba puesto.
      for (const canal of CANALES) {
        expect(canal.etiqueta.trim().length).toBeGreaterThan(0);
        expect(canal.detalle.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
