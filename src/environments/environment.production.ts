export const environment = {
  production: true,
  // Mismo nombre que dev para evitar que los servicios rompan en build prod.
  // Mantenemos `apiUrl` (legacy) y `apiBaseUrl` (actual) por compatibilidad.
  apiUrl: 'https://api.sparkmatch.pe/v1',
  apiBaseUrl: 'https://api.sparkmatch.pe/v1',
  // PENDIENTE, igual que `apiUrl`: espera la decision de dominio. Y ademas el
  // contexto de informes todavia NO esta desplegado en prod -- el stack
  // `spark-match-backend-prod` es del 2026-08-08 y los endpoints de informes
  // entraron en dev el 2026-08-10 (PR #221). Cuando se promocione a main hay
  // que traer aqui el output `ReportsHttpApiUrl` del stack de prod.
  reportsApiUrl: 'https://api.sparkmatch.pe/v1',
  // Pendiente de la decision de dominio, igual que `apiUrl`.
  agentUrl: 'https://agent.sparkmatch.pe',
  authStorageKey: 'spark-match.auth',

  // En prod el backend real responde; los mocks quedan deshabilitados.
  useMocks: false,
};
