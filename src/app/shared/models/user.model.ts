/**
 * Contrato real del backend (spark-match-03-backend).
 *
 * Fuente de verdad:
 *   contexts/identity/src/schemas/login.schema.ts
 *   contexts/identity/src/schemas/register.schema.ts
 *
 * Antes este archivo declaraba un contrato inventado a partir de los
 * formularios, con `token` donde el backend devuelve `accessToken`. El efecto
 * era silencioso y total: `localStorage` guardaba `undefined`, el guard dejaba
 * pasar con ese token basura, y toda peticion autenticada respondia 401.
 */

/**
 * El backend devuelve id, email, fullName y `role`. `age`, `region` e
 * `interestArea` se capturan en el formulario de registro pero todavia no se
 * persisten ni se devuelven: quedan opcionales hasta que exista el endpoint de
 * perfil extendido.
 *
 * `role` es OPCIONAL aqui aunque el backend lo declare obligatorio, y la razon
 * importa: en `localStorage` puede haber sesiones guardadas antes de que el
 * backend empezara a enviarlo. Si el tipo lo exigiera, esas sesiones romperian
 * al deserializarse.
 *
 * Que sea opcional obliga a decidir que significa su ausencia, y la respuesta
 * esta en `AuthService.isAdmin`: ausencia significa NO admin. Nunca al reves.
 */
export type UserRole = 'admin' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role?: UserRole;
  age?: number;
  region?: string;
  interestArea?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  age: number;
  region: string;
  interestArea?: string;
}

/** POST /v1/auth/login */
export interface LoginResponse {
  accessToken: string;
  /** Segundos de validez del accessToken. */
  expiresIn: number;
  user: AuthUser;
}

/**
 * POST /v1/auth/register -> 201.
 *
 * NO devuelve token: el registro no abre sesion. Despues de un registro
 * exitoso hay que mandar al usuario a login.
 */
export interface RegisterResponse {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  role?: UserRole;
}
