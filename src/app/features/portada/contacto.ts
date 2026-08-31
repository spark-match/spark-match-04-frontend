/**
 * Por dónde se puede contactar con Spark Match desde la portada pública.
 *
 * Son **enlaces directos, no un formulario**, y es una decisión: un formulario
 * necesita un endpoint que reciba, algo que guarde lo recibido y alguien que lo
 * lea. Nada de eso existe todavía, y un formulario que se traga los mensajes es
 * peor que no tener formulario — quien escribe se queda esperando respuesta a
 * algo que nunca salió del navegador.
 *
 * Un canal con `destino` vacío **no se pinta**. Así se pueden dejar declarados
 * los que todavía no tienen cuenta abierta sin que aparezca en la web un enlace
 * que no lleva a ningún sitio; el día que exista el número o el perfil, se
 * rellena la cadena y sale solo.
 */

export type IconoDeContacto = 'correo' | 'whatsapp' | 'instagram' | 'linkedin';

export interface CanalDeContacto {
  /** Lo que se lee en la tarjeta. */
  etiqueta: string;
  /** La dirección o el identificador, tal cual, para poder copiarlo. */
  detalle: string;
  /** El `href`. Vacío mientras el canal no exista de verdad. */
  destino: string;
  icono: IconoDeContacto;
}

export const CANALES: CanalDeContacto[] = [
  {
    etiqueta: 'Correo',
    detalle: 'ahincho@unsa.edu.pe',
    destino: 'mailto:ahincho@unsa.edu.pe?subject=Consulta%20sobre%20Spark%20Match',
    icono: 'correo',
  },
  {
    etiqueta: 'WhatsApp',
    detalle: 'Escríbenos y te respondemos',
    // Falta el número. `https://wa.me/51XXXXXXXXX` en cuanto haya una línea
    // que atienda; hasta entonces la tarjeta no se pinta.
    destino: '',
    icono: 'whatsapp',
  },
  {
    etiqueta: 'Instagram',
    detalle: '@sparkmatch.pe',
    // Falta la cuenta.
    destino: '',
    icono: 'instagram',
  },
  {
    etiqueta: 'LinkedIn',
    detalle: 'Spark Match',
    // Falta la página.
    destino: '',
    icono: 'linkedin',
  },
];

/** Los que se pueden enseñar: tienen a dónde llevar. */
export function canalesPublicables(canales: CanalDeContacto[] = CANALES): CanalDeContacto[] {
  return canales.filter((canal) => canal.destino.trim().length > 0);
}
