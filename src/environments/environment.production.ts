export const environment = {
  production: true,
  // Mismo nombre que dev para evitar que los servicios rompan en build prod.
  // Mantenemos `apiUrl` (legacy) y `apiBaseUrl` (actual) por compatibilidad.
  apiUrl: 'https://api.sparkmatch.pe/v1',
  apiBaseUrl: 'https://api.sparkmatch.pe/v1',
  authStorageKey: 'spark-match.auth',

  // En prod el backend real responde; los mocks quedan deshabilitados.
  useMocks: false,

  features: {
    assessmentEnabled: true,
    matchingEnabled: true,
    chatbotEnabled: true,
  },
};
