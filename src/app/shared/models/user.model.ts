/**
 * Contrato INVENTADO a partir de los formularios de LoginPage/RegisterPage.
 */

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
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

export interface AuthResponse {
  user: AuthUser;
  /** JWT o token de sesión emitido por el backend. */
  token: string;
}
