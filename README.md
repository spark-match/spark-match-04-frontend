# Spark Match — Frontend (04-frontend)

> Aplicación web SPA del Copiloto de Orientación Vocacional con IA Generativa.
> Construida con **Angular 21 standalone** + **Angular Material 21** + **SCSS** + **i18n nativo**.

## 🚀 Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Angular (standalone components) | `^21.2.0` |
| UI Components | Angular Material + CDK | `^21.2.14` |
| Estilos | SCSS con theming Material | - |
| Routing | Angular Router con lazy loading | `^21.2.0` |
| HTTP | HttpClient con interceptors | - |
| Forms | Reactive Forms | `^21.2.0` |
| i18n | `@angular/localize` | `^21.2.18` |
| Animaciones | `@angular/animations` (async) | `^21.2.0` |
| Testing | **Vitest** (default en Angular 21) | `^4.0.8` |
| Linter | ESLint + Prettier | - |
| TypeScript | Strict mode | `~5.9.2` |

## 📋 Prerequisitos

- Node.js `^24.11.0` o `>= 22.22.3`
- npm `>= 11.6.0`
- Angular CLI `^21.2.18` (opcional, usar `npx ng ...`)

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
npm test -- --watch=false # single run

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
│   ├── core/                     # Servicios singleton, guards, interceptors
│   │   ├── auth/                 # auth.guard, auth.service, auth.interceptor
│   │   ├── http/                 # error.interceptor
│   │   ├── config/               # app.config (constantes)
│   │   ├── i18n/                 # (futuro) helper para i18n
│   │   └── errors/               # (futuro) error handler global
│   │
│   ├── shared/                   # Componentes, pipes, directivas reutilizables
│   │   ├── components/
│   │   ├── directives/
│   │   ├── pipes/
│   │   └── types/
│   │
│   ├── layout/                   # Shell + navegación
│   │   ├── shell/                # Layout principal (mat-sidenav-container)
│   │   ├── header/               # Toolbar superior
│   │   ├── sidenav/              # Menú lateral
│   │   └── footer/
│   │
│   ├── features/                 # Bounded contexts (DDD)
│   │   ├── landing/              # Página de inicio
│   │   ├── auth/                 # Login, register, forgot-password
│   │   ├── assessment/           # Cuestionario RIASEC
│   │   ├── careers/              # Catálogo de carreras
│   │   ├── results/              # Resultados de matching
│   │   ├── profile/              # Perfil de usuario
│   │   └── not-found/            # 404
│   │
│   ├── app.ts                    # Componente raíz
│   ├── app.config.ts             # Providers globales (router, http, animations, i18n)
│   ├── app.routes.ts             # Rutas principales (lazy loading)
│   └── app.spec.ts               # Tests del componente raíz
│
├── environments/                 # Configuración por entorno
│   ├── environment.ts            # Producción (NO commitear con secretos)
│   └── environment.example.ts    # Plantilla (SÍ commitear)
│
├── locale/                       # Archivos de i18n
│   ├── messages.xlf              # Español (default)
│   └── messages.en.xlf           # Inglés
│
├── styles.scss                   # Tema global Material + utility classes
└── index.html
```

## 🌐 Rutas

| Path | Página | Auth |
|---|---|---|
| `/` | Landing | Pública |
| `/auth/login` | Login | Pública |
| `/auth/register` | Registro | Pública |
| `/auth/forgot-password` | Recuperar contraseña | Pública |
| `/assessment` | Cuestionario RIASEC | Protegida |
| `/assessment/:id` | Detalle de cuestionario | Protegida |
| `/careers` | Catálogo de carreras | Pública |
| `/careers/:id` | Detalle de carrera | Pública |
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
- Para CI: `npm test -- --watch=false --browsers=ChromeHeadlessCI`
- Coverage: `coverage/` (ignorado por git)

## 📦 Build

- **Output**: `dist/spark-match-frontend/`
- **Configuraciones**:
  - `production` (default para deploy a `main`)
  - `development` (para deploy a `dev`)

## 🚦 CI/CD

- **CI**: `.github/workflows/ci.yml` — typecheck + lint + test + build en cada PR
- **Deploy**: `.github/workflows/deploy.yml` — placeholder Fase 5 (S3 + CloudFront)

## 🔗 Repos relacionados

- [`02-infrastructure`](https://github.com/spark-match/spark-match-02-infrastructure) — Terraform (VPC, Aurora, etc.)
- [`03-backend`](https://github.com/spark-match/spark-match-03-backend) — SAM (Lambdas, API Gateway)
- [`08-deep-agent`](https://github.com/spark-match/spark-match-08-deep-agent) — AI Advisor (AgentCore)

## 📄 Licencia

MIT - ver [`LICENSE`](./LICENSE)
