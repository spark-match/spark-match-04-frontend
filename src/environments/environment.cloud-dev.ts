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
  // OTRO API Gateway, no el de arriba. El contexto de informes tiene el suyo
  // propio porque SAM compila cada `AWS::Serverless::HttpApi` en su propio
  // OpenAPI: meterlo en el de identity habria acoplado los dos despliegues.
  //
  // Sale del MISMO stack que `apiUrl`, pero de otro output:
  //   aws cloudformation describe-stacks --stack-name spark-match-backend-dev \
  //     --query "Stacks[0].Outputs[?OutputKey=='ReportsHttpApiUrl'].OutputValue" \
  //     --output text --profile spark-match-admin
  //
  // Hasta el 2026-08-10 esta URL no existia en ningun environment y
  // `ReportsService` pedia los informes al Gateway de identity. Con `useMocks`
  // en false --que es como va este ambiente-- eso era un 404 garantizado, y
  // ese 404 es el spinner eterno que se veia en la pantalla de resultados.
  reportsApiUrl: 'https://gv0e33t224.execute-api.us-east-1.amazonaws.com/dev/v1',
  // CloudFront delante del ALB del agente. Hardcodeada igual que `apiUrl`;
  // infra la publica en SSM /spark-match/dev/config/agent-endpoint-url y lo
  // correcto seria leerla ahi en build-time (ver README).
  agentUrl: 'https://d2qj0spvb60idg.cloudfront.net',
  authStorageKey: 'spark-match.auth',

  // El punto de este ambiente: pegarle al backend de verdad.
  useMocks: false,
};
