import { Injectable, inject } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { Title } from '@angular/platform-browser';

/** Lo que se enseña en la pestaña cuando una ruta no dice de qué sección es. */
export const SECCION_POR_DEFECTO = 'Orientación vocacional con IA';

/** El nombre del producto, delante siempre. */
export const MARCA = 'Spark Match';

/** `Spark Match — Sección`, que es el formato de toda la aplicación. */
export function tituloDeLaPestana(seccion: string | undefined): string {
  const limpia = (seccion ?? '').trim();
  return limpia ? `${MARCA} — ${limpia}` : `${MARCA} — ${SECCION_POR_DEFECTO}`;
}

/**
 * Pone el título de la pestaña en cada navegación, diga algo la ruta o no.
 *
 * La estrategia que trae Angular sólo llama a `setTitle` cuando la ruta
 * declara `title`; si no lo declara, **deja el anterior puesto**. Y como sólo
 * cuatro de las rutas lo declaraban, la pestaña mentía de forma bastante
 * visible: entrabas por el login y en «Inicio» seguía diciendo «Iniciar
 * sesión», o pasabas por el informe y en «Mi perfil» se quedaba «Mis
 * resultados». Nada estaba roto en esas pantallas — simplemente nadie las
 * había nombrado, y el silencio se leía como el nombre de la anterior.
 *
 * Aquí no hay silencio posible: sin `title` sale el genérico, que dice al
 * menos de qué producto se trata. Y el formato vive en un solo sitio, así que
 * las rutas sólo tienen que decir su sección — «Inicio», no «Inicio · Spark
 * Match» repetido quince veces con la separación puesta a mano.
 */
@Injectable({ providedIn: 'root' })
export class SparkMatchTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.title.setTitle(tituloDeLaPestana(this.buildTitle(snapshot)));
  }
}
