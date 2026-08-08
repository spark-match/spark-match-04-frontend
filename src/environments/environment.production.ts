export const environment = {
  production: true,
  // Mismo nombre que dev para evitar que los servicios rompan en build prod.
  // Mantenemos `apiUrl` (legacy) y `apiBaseUrl` (actual) por compatibilidad.
  apiUrl: 'https://api.sparkmatch.pe/v1',
  apiBaseUrl: 'https://api.sparkmatch.pe/v1',
  // Pendiente de la decision de dominio, igual que `apiUrl`.
  agentUrl: 'https://agent.sparkmatch.pe',
  authStorageKey: 'spark-match.auth',

  // En prod el backend real responde; los mocks quedan deshabilitados.
  useMocks: false,
};
