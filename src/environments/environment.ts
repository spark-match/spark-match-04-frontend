export const environment = {
  production: false,
  // Mantenemos ambos nombres por ahora para no romper los servicios antiguos ni los nuevos
  apiUrl: 'http://localhost:8000/api',
  apiBaseUrl: 'http://localhost:8000/api',
  // El deep-agent corriendo en local (`uv run python -m src.api.server`).
  agentUrl: 'http://localhost:8000',
  authStorageKey: 'spark-match.auth',

  // Mientras el backend de FastAPI no esté 100% funcional
  useMocks: true,

  features: {
    assessmentEnabled: true,
    matchingEnabled: false,
    chatbotEnabled: false,
  },
};
