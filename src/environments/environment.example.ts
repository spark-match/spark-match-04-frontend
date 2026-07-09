/**
 * Copia este archivo a `environment.ts` y `environment.development.ts`
 * con los valores reales para cada entorno. NUNCA commitear con secretos.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/v1',
  authStorageKey: 'spark-match.auth',
  features: {
    assessmentEnabled: true,
    matchingEnabled: false,
    chatbotEnabled: false
  }
};
