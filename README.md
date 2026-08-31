# Spark Match — Frontend (04-frontend)

> Aplicación web SPA del Copiloto de Orientación Vocacional con IA Generativa.
> Construida con **Angular 22 standalone** + **Angular Material 22** + **Angular Aria** + **SCSS** + **i18n nativo**.

## 🚀 Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Angular (standalone components, Signal APIs, Signal Forms) | `^22.0.8` |
| UI Components | Angular Material + CDK + Aria | `^22.0.6` |
| Estilos | SCSS con theming Material | - |
| Routing | Angular Router con lazy loading | `^22.0.8` |
| HTTP | HttpClient con interceptors | - |
| Forms | Reactive Forms + Signal Forms | `^22.0.8` |
| i18n | `@angular/localize` | `^22.0.8` |
| Animaciones | `@angular/animations` (async) | `^22.0.8` |
| Testing | **Vitest 4** + `@vitest/coverage-v8` | `^4.0.8` / `^4.1.10` |
| Linter | ESLint (`angular-eslint`) + Prettier | `22.1.0` / `8.62.1` |
| TypeScript | Strict mode | `~6.0.3` |

## 📋 Prerequisitos

- Node.js `^24.11.0` o `>= 22.22.3`
- npm `>= 11.6.0`
- Angular CLI `^22.0.8` (opcional, usar `npx ng ...`)

## 🛠️ Comandos

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm start                 # http://localhost:4200

# Build producción
npm run build             # dist/

# Tests (Vitest)
npm test                  # watch mode
npm test -- --watch=false # single run (CI)

# Coverage + thresholds (CI mode)
npm test -- --watch=false --coverage
# → falla local si coverage < thresholds definidos en angular.json

# Type check
npm run typecheck         # tsc --noEmit

# Lint
npm run lint

# i18n: extraer strings traducibles
npm run i18n:extract      # genera src/locale/messages.xlf
```

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── core/                          # Servicios singleton, guards, interceptors
│   │   ├── auth/
│   │   │   ├── auth.guard.ts          # CanMatchFn
│   │   │   ├── auth.service.ts        # login/register/logout/restore
│   │   │   └── auth.interceptor.ts    # Bearer token
│   │   ├── http/
│   │   │   └── error.interceptor.ts   # Global error handling
│   │   └── config/
│   │       └── app.config.ts          # Providers globales (router, http, animations, i18n)
│   │
│   ├── shared/                        # Componentes, pipes, directivas reutilizables
│   │   ├── components/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── types/
│   │
│   ├── layout/                        # Shell + navegación
│   │   └── app-layout/                # Layout principal (mat-sidenav-container)
│   │
│   ├── features/                      # Bounded contexts (DDD)
│   │   ├── landing/                   # Página de inicio
│   │   ├── auth/                      # Login, register, forgot-password
│   │   ├── assessment/                # Cuestionario RIASEC
│   │   ├── careers/                   # Catálogo de carreras
│   │   ├── results/                   # Resultados de matching
│   │   ├── chat/                      # Conversación con AI Advisor
│   │   ├── filters/                   # Filtros de búsqueda
│   │   ├── reports/                   # Generación de reportes PDF
│   │   ├── profile/                   # Perfil de usuario
│   │   └── not-found/                 # 404
│   │
│   ├── app.ts                         # Componente raíz
│   ├── app.config.ts                  # Providers globales
│   ├── app.routes.ts                  # Rutas principales (lazy loading)
│   ├── app.routes.spec.ts             # Tests de configuración de rutas
│   └── app.spec.ts                    # Tests del componente raíz
│
├── environments/                      # Configuración por entorno
│   ├── environment.ts                 # Producción (NO commitear con secretos)
│   └── environment.example.ts         # Plantilla (SÍ commitear)
│
├── locale/                            # Archivos de i18n
│   ├── messages.xlf                   # Español (default)
│   └── messages.en.xlf                # Inglés
│
├── styles.scss                        # Tema global Material + utility classes
└── index.html
```

## 🌐 Rutas

| Path | Página | Auth |
|---|---|---|
| `/` | Redirect → `/home` | — |
| `/auth/login` | Login | Pública |
| `/auth/register` | Registro | Pública |
| `/auth/forgot-password` | Recuperar contraseña | Pública |
| `/home` | Landing | Protegida |
| `/filters` | Filtros de carreras | Protegida |
| `/assessment` | Cuestionario RIASEC | Protegida |
| `/assessment/:id` | Detalle de cuestionario | Protegida |
| `/careers` | Catálogo de carreras | Protegida |
| `/results` | Resultados de matching | Protegida |
| `/profile` | Perfil de usuario | Protegida |
| `**` | 404 | Pública |

## 🎨 Theming

- **Tema Material**: azure-blue (primary) + cyan (tertiary)
- **Densidad**: 0 (default, más espaciado)
- **Tipografía**: Roboto
- Personalizar en `src/styles.scss`

## 🌍 i18n

- **Default locale**: `es-PE` (español de Perú)
- **Locales soportados**: `es-PE`, `en-US`
- **Source language**: `es-PE`
- Para agregar strings: usar `i18n="@@id.unico"` en templates
- Para extraer: `npm run i18n:extract` (genera `messages.xlf`)

## 🧪 Testing

- **Framework**: Vitest 4 (más rápido que Karma/Jasmine)
- **Comando**: `npm test`
- **Single run (CI)**: `npm test -- --watch=false --coverage`
- **Coverage report**: `coverage/spark-match-frontend/lcov.info` (lcov, ignorado por git)
- **Coverage thresholds** (en `angular.json`):
  - lines: 80% (alineado con SonarCloud QG)
  - branches: 80%
  - statements: 75% (headroom ~5% sobre el actual 79.86%)
  - functions: 50% (muchas funciones exportadas no se testean unitariamente)

  Tests que caigan debajo de estos umbrales **falla el build local** antes de llegar a CI.

## 🚦 CI/CD

### Workflows

- **CI**: `.github/workflows/ci.yml` — corre en cada PR y push a `dev`/`main`
- **CodeQL**: `.github/workflows/codeql.yml` — análisis de seguridad semanal + en PRs
- **Deploy**: `.github/workflows/deploy.yml` — placeholder Fase 5 (S3 + CloudFront)

### CI Jobs (consume reusables de `spark-match-01-devops`)

| Job | Reusable |
|---|---|
| `actionlint` | `actionlint.yml` |
| `gitleaks` | `gitleaks.yml` |
| `yamllint` | `yamllint.yml` |
| `eslint` | `eslint.yml` |
| `typecheck` | `node-typecheck.yml` |
| `unit tests` | `node-test.yml` |
| `production build` | `node-build.yml` |
| `SonarCloud` | `sonar-typescript.yml` |

### Quality Gate

- **QG name**: `Spark Match Way`
- **Threshold**: coverage ≥80% (lines + new code)
- **Storage**: SonarCloud `spark-match` org

### Branch protection (ruleset)

- `~DEFAULT_BRANCH` + `refs/heads/dev`
- Required status checks: los 8 jobs de CI + CodeQL
- Squash merge only
- CODEOWNERS: `@spark-match/frontend-devs`

## 🔗 Repos relacionados

- [`01-devops`](https://github.com/spark-match/spark-match-01-devops) — Reusables CI/CD + governance
- [`02-infrastructure`](https://github.com/spark-match/spark-match-02-infrastructure) — Terraform (VPC, RDS PostgreSQL, ECS, CloudFront)
- [`03-backend`](https://github.com/spark-match/spark-match-03-backend) — SAM (Lambdas, API Gateway)
- [`07-deep-agent`](https://github.com/spark-match/spark-match-07-deep-agent) — Agente conversacional (LangGraph + AG-UI + Bedrock, en ECS Fargate)

## Despliegue

Pipeline CI/CD:

- Lint, typecheck, tests, build prod y SonarCloud corren en cada PR y push a dev/main (ver `.github/workflows/ci.yml`).
- Deploy automatico: push a dev -> environment `development`; push a main -> environment `production`. Ver `.github/workflows/deploy.yml`.
- Manual: Actions tab -> Deploy dry run -> Run workflow (valida sin escribir) o Deploy -> Run workflow.

Hosts:

- dev: `https://<distribution>.cloudfront.net` (default domain de CloudFront, sin dominio custom).
- prod: `https://<distribution>.cloudfront.net` (default domain, dominio custom diferido).

Configuracion por ambiente en `src/environments/`.

Secrets de deploy se configuran por GH Environment (`development` y `production`) sin sufijo en el nombre: el binding al env provee el scoping. Ver `AGENTS.md` para detalle operativo, roles OIDC, rollback, troubleshooting y el checklist del primer deploy.

## 📄 Licencia

MIT - ver [`LICENSE`](./LICENSE)