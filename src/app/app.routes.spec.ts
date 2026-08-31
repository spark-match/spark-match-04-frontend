import { TestBed } from '@angular/core/testing';
import { Route, provideRouter } from '@angular/router';

import { routes } from './app.routes';

/*
 * Se comprueba por posición y no solo por contenido a propósito: en el primer
 * nivel hay DOS rutas con `path: ''` --la portada pública y el layout de la
 * aplicación-- y el router se queda con la primera que case. Si alguien las
 * intercambia, `/` deja de enseñar la portada y no falla nada: enseña el layout
 * con la barra lateral a alguien que a lo mejor ni tiene cuenta.
 */
function raiz(): Route[] {
  return routes.filter((r) => r.path === '');
}

describe('app.routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  it('registra 4 rutas de primer nivel (auth, portada, layout, comodín)', () => {
    expect(routes.map((r) => r.path)).toEqual(['auth', '', '', '**']);
  });

  describe('la portada pública', () => {
    it('va antes que el layout y solo se queda con la raíz', () => {
      const [portada] = raiz();

      expect(portada.pathMatch).toBe('full');
      expect(portada.loadComponent).toBeTruthy();
      // Sin componente propio: no cuelga del `AppLayoutComponent`, que es lo
      // que la deja sin barra lateral.
      expect(portada.component).toBeUndefined();
    });

    it('no está protegida', () => {
      const [portada] = raiz();

      expect(portada.canActivate).toBeUndefined();
    });
  });

  describe('el layout de la aplicación', () => {
    it('monta AppLayoutComponent bajo la ruta vacía', () => {
      const [, layout] = raiz();

      expect(layout.component).toBeTruthy();
    });

    it('expone las 6 secciones del producto', () => {
      const [, layout] = raiz();
      const paths = (layout.children ?? []).map((c) => c.path);

      expect(paths).toEqual(
        expect.arrayContaining(['home', 'filters', 'assessment', 'careers', 'results', 'profile']),
      );
      expect(paths.length).toBe(6);
    });

    /*
     * Antes había un séptimo hijo, `{ path: '', redirectTo: '/home' }`, que era
     * quien atendía la raíz. Ya no: la raíz la atiende la portada, y dejar el
     * redirect aquí no haría nada visible --nunca se llega-- pero sí haría
     * dudar de cuál de los dos manda.
     */
    it('ya no redirige la raíz, porque no le llega', () => {
      const [, layout] = raiz();

      expect((layout.children ?? []).some((c) => c.path === '')).toBe(false);
    });

    it('protege las 6 secciones con authGuard', () => {
      const [, layout] = raiz();

      for (const child of layout.children ?? []) {
        expect(child.canActivate, `${child.path} debería llevar canActivate`).toBeTruthy();
      }
    });
  });
});
