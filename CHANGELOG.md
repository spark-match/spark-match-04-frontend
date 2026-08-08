# Changelog

Todos los cambios notables a este proyecto se documentan aquí.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-26

### Added
- Migración completa a **Angular 22** (standalone components, Signal APIs, Signal Forms).
- `@angular/aria` para accesibilidad guiada.
- Nuevas features: `chat` (AI Advisor), `filters` (filtros de carreras), `reports` (reportes PDF).
- `app-layout.component` para shell de navegación unificado.
- Cobertura de tests: 17 spec files / 68 tests / **82.11% lines, 84.77% branches**.
- `.yamllint.yml` con config que ignora `node_modules/`, `.angular/`, `dist/`, `coverage/`, `.github/workflows/`.
- CI consume 8 reusables de [`spark-match-01-devops`](https://github.com/spark-match/spark-match-01-devops):
  actionlint, gitleaks, yamllint, eslint, node-typecheck, node-test, node-build, sonar-typescript.
- CodeQL standalone con matrix `actions + typescript` (análisis de seguridad semanal + en PRs).
- SonarCloud integrado con QG `Spark Match Way` (coverage ≥80%, 0 bugs, 0 vulnerabilities).
- Ruleset del repo activa los 8 jobs de CI como `required_status_checks`.
- `coverageThresholds` locales en `angular.json` (lines: 80, branches: 80, statements: 75, functions: 50) — falla builds locales antes de push.
- Variable de repo `SONAR_TEST_INCLUSIONS=**/*.spec.ts` para SonarCloud.
- Variable de repo `SONAR_TESTS=src` (directorio, requerido por Sonar para `sonar.tests`).

### Changed
- Upgrade de Angular 21 → 22 (todas las deps `@angular/*` a `^22.0.x`).
- Upgrade TypeScript `~5.9.2` → `~6.0.3`.
- Upgrade Vitest `^4.0.8` + `@vitest/coverage-v8@^4.1.10` (devDep).
- `package.json` reorganizado (Angular 22 no requiere `@angular/animations` directo).
- Estructura de `core/auth/` con interceptor + service + guard.
- README reescrito: stack actualizado, sección CI/CD con reusables, sección Testing con thresholds.

### Fixed
- `.github/workflows/deploy.yml`: CRLF→LF, removido `needs: build` (job inexistente), placeholder Phase 5 con `printf` quoting (actionlint SC2086 fix).
- Coverage previamente en **60.29%** lines → ahora **82.11%** lines (supera QG ≥80%).

[Unreleased]: https://github.com/spark-match/spark-match-04-frontend/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/spark-match/spark-match-04-frontend/compare/v0.1.0...v0.2.0