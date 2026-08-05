/**
 * Ambiente `cloud-dev`: la app desplegada en el CloudFront de dev, apuntando
 * al backend real de dev (no a localhost, no a mocks).
 *
 * `apiUrl` se rellena con la URL real del API Gateway despues del primer
 * deploy del backend a dev. El valor de abajo es el placeholder: mientras diga
 * REEMPLAZAR, el build de cloud-dev no sirve para nada mas que compilar.
 *
 * La URL sale de:
 *   aws cloudformation describe-stacks --stack-name spark-match-backend-dev \
 *     --query "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue" \
 *     --output text --profile spark-match-admin
 *
 * Ojo con el `/v1` final: los otros environments lo incluyen en `apiUrl` y
 * AuthService arma sus rutas como `${apiUrl}/auth/login`.
 */
export const environment = {
  production: false,
  apiUrl: 'https://REEMPLAZAR.execute-api.us-east-1.amazonaws.com/dev/v1',
  apiBaseUrl: 'https://REEMPLAZAR.execute-api.us-east-1.amazonaws.com/dev/v1',
  authStorageKey: 'spark-match.auth',

  // El punto de este ambiente: pegarle al backend de verdad.
  useMocks: false,

  features: {
    assessmentEnabled: true,
    matchingEnabled: false,
    chatbotEnabled: false,
  },
};
