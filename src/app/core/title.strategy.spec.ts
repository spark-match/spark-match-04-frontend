import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';

import { MARCA, SECCION_POR_DEFECTO, SparkMatchTitleStrategy, tituloDeLaPestana } from './title.strategy';

describe('tituloDeLaPestana', () => {
  it('pone la marca delante y la sección detrás', () => {
    expect(tituloDeLaPestana('Inicio')).toBe(`${MARCA} — Inicio`);
  });

  it('sin sección dice al menos de qué producto se trata', () => {
    expect(tituloDeLaPestana(undefined)).toBe(`${MARCA} — ${SECCION_POR_DEFECTO}`);
    expect(tituloDeLaPestana('')).toBe(`${MARCA} — ${SECCION_POR_DEFECTO}`);
    expect(tituloDeLaPestana('   ')).toBe(`${MARCA} — ${SECCION_POR_DEFECTO}`);
  });
});

@Component({ standalone: true, template: '' })
class PaginaVacia {}

/*
 * Se navega de verdad, con el router real, en vez de fabricar un
 * `RouterStateSnapshot` a mano: el título sale de `buildTitle`, que lee una
 * clave interna de `data` que sólo pone el propio router. Un snapshot falso
 * probaría mi imitación de Angular, no el comportamiento.
 */
describe('SparkMatchTitleStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'con-titulo', component: PaginaVacia, title: 'Mi perfil' },
          { path: 'sin-titulo', component: PaginaVacia },
        ]),
        { provide: TitleStrategy, useClass: SparkMatchTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('escribe el título de la ruta con el formato de la marca', async () => {
    await router.navigateByUrl('/con-titulo');

    expect(title.getTitle()).toBe('Spark Match — Mi perfil');
  });

  /*
   * El fallo que esto vino a arreglar. La estrategia de Angular sólo llama a
   * `setTitle` cuando la ruta declara `title`; si no lo declara, deja el
   * anterior puesto. Y como `home`, `filters` y `profile` no lo declaraban,
   * entrabas por el login y en «Inicio» seguía diciendo «Inicio de sesión».
   */
  it('una ruta sin título NO se queda con el de la anterior', async () => {
    await router.navigateByUrl('/con-titulo');
    expect(title.getTitle()).toContain('Mi perfil');

    await router.navigateByUrl('/sin-titulo');

    expect(title.getTitle()).not.toContain('Mi perfil');
    expect(title.getTitle()).toBe(`Spark Match — ${SECCION_POR_DEFECTO}`);
  });
});
