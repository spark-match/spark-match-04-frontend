/**
 * Ambiente `cloud-dev`: la app desplegada en el CloudFront de dev, apuntando
 * al backend real de dev (no a localhost, no a mocks).
 *
 * `apiUrl` apunta al API Gateway real de dev, creado por el primer deploy del
 * backend (stack `spark-match-backend-dev`, 2026-08-05). Ya no es placeholder.
 *
 * La URL sale de:
 *   aws cloudformation describe-stacks --stack-name spark-match-backend-dev \
 *     --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
 *     --output text --profile spark-match-admin
 *
 * Si el stack se recrea desde cero, el id del API cambia y hay que actualizar
 * este fichero: el id no es estable entre borrados del stack.
 *
 * Ojo con el `/v1` final: los otros environments lo incluyen en `apiUrl` y
 * AuthService arma sus rutas como `${apiUrl}/auth/login`.
 */
export const environment = {
  production: false,
  apiUrl: 'https://wu0zw05owi.execute-api.us-east-1.amazonaws.com/dev/v1',
  apiBaseUrl: 'https://wu0zw05owi.execute-api.us-east-1.amazonaws.com/dev/v1',
  authStorageKey: 'spark-match.auth',

  // El punto de este ambiente: pegarle al backend de verdad.
  useMocks: false,

  features: {
    assessmentEnabled: true,
    matchingEnabled: false,
    chatbotEnabled: false,
  },
};
