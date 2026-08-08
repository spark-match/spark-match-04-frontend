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
};

/*
 * Aquí vivía un bloque `features` con assessmentEnabled, matchingEnabled y chatbotEnabled,
 * y estaba en los tres environments más una cuarta copia en `core/config/app.config.ts`.
 * Se ha borrado entero, junto con esa cuarta copia, porque NO GATEABA NADA: ningún
 * componente, ruta, guard ni servicio leía `environment.features`.
 *
 * Las cuatro copias además se contradecían. En el artefacto desplegado de dev iban
 * compilados `chatbotEnabled:false` y `matchingEnabled:false`, mientras `app.config.ts`
 * declaraba lo contrario. Si los flags hubieran funcionado, el chat —lo único del producto
 * que hoy funciona de punta a punta— habría estado apagado en el único entorno desplegado.
 * Que no rompiera nada fue suerte, no diseño.
 *
 * Es la misma familia que el `paths-ignore` de 03-backend y que los rulesets sin
 * `required_status_checks`: un control que aparenta proteger algo y no protege nada.
 *
 * Si algún día hace falta apagar una feature, el flag se añade CON su consumidor en el
 * mismo commit, y con una prueba que falle si el consumidor desaparece.
 */
