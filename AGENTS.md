# Agents — spark-match-04-frontend

> Convenciones operativas para agentes e ingenieros que trabajen en este repo.
> Inspirado en spark-match-01-devops/AGENTS.md. Si hay conflicto, gana 01-devops.

## Convenciones

- kebab-case para nombres de archivo, workflow, job, step.
- Conventional Commits 1.0.0. Scopes permitidos: app, build, ci, deps, docs, feat, fix, i18n, infra, perf, refactor, style, test, ui. Para cambios de deploy/CI usar scope `infra` o `ci`.
- Sin emojis en codigo, commits, PRs, docs. Marcadores de lista estructural permitidos.
- Sin comentarios en codigo salvo que el reviewer los solicite explicitamente.
- Identificadores en ingles; documentacion, commits, PRs en espanol.
- Tags flotantes en actions externas (vN). SHA-pinning prohibido (ver spark-match-01-devops/tests/bats/no-sha-pinning.bats).
- Workflows reusables de spark-match-01-devops: pin @main (ver spark-match-01-devops/docs/VERSIONING.md, decision 2026-07: single-main-branch).

## Comandos

- `npm ci` (instalar deps limpias).
- `npm run build` (prod).
- `npm test -- --watch=false --coverage` (modo CI).
- `npm run typecheck`.
- `npm run lint`.
- `npm run i18n:extract`.
- `npm run predeploy:check` (valida dist antes de un deploy; ver scripts/check-deploy.mjs).
- `npm run predeploy:check:fast` (omite el build, valida dist existente).

## Deploy

### Ambientes

- dev: rama dev -> GH Environment `development` -> bucket spark-match-frontend-dev -> sin dominio custom (usa `<distribution>.cloudfront.net`).
- prod: rama main -> GH Environment `production` -> bucket spark-match-frontend-prod -> sin dominio custom por ahora.

### Niveles de secretos/variables (organizacion > repos > ambientes)

Este repo sigue el modelo jerarquico de spark-match:

- Organizacion: defaults para SonarCloud, CodeQL, Dependabot, OIDC provider en AWS.
- Repositorio: vars como `SONAR_PROJECT_KEY`, `DEFAULT_NODE_VERSION`, `PACKAGE_MANAGER`.
- Ambiente (este es el caso para deploy): secrets por GH Environment.

Los secrets de deploy VIVEN en el GH Environment, no en repo settings generales. Se resuelven por env activo gracias al `environment:` del job en `deploy.yml`. Por eso NO llevan sufijo `_DEV`/`_PROD`: el mismo nombre existe en ambos envs con valores distintos.

- `production` env:
  - `AWS_FRONTEND_DEPLOY_ROLE_ARN` = `arn:aws:iam::<account>:role/spark-match-frontend-deploy-prod`
  - `CLOUDFRONT_DISTRIBUTION_ID` = `<id de la distribucion prod>`
- `development` env:
  - `AWS_FRONTEND_DEPLOY_ROLE_ARN` = `arn:aws:iam::<account>:role/spark-match-frontend-deploy-dev`
  - `CLOUDFRONT_DISTRIBUTION_ID` = `<id de la distribucion dev>`

Los roles en IAM si tienen sufijo `-dev` / `-prod` porque su trust policy es distinto por env:

- dev:  `repo:spark-match/spark-match-04-frontend@*:ref:refs/heads/dev`
            + `environment:development`
- prod: `repo:spark-match/spark-match-04-frontend@*:ref:refs/heads/main`
            + `environment:production`

El role prod no puede ser asumido desde un deploy a dev (no confia en `ref=dev` ni en `environment=development`) y viceversa. No hay fallback repo-wide: si un secret falta en el env, el deploy falla de forma explicita (preferible a un fallback silencioso).

### GH Environments (repo settings -> Environments)

- `development`:
  - Deployment branches: `dev`
  - Required reviewers: ninguno (auto-approve).
  - Secrets: `AWS_FRONTEND_DEPLOY_ROLE_ARN`, `CLOUDFRONT_DISTRIBUTION_ID`.

- `production`:
  - Deployment branches: `main`
  - Required reviewers: `@spark-match/frontend-devs` Y `@spark-match/product-owners` (ambos deben aprobar).
  - Secrets: `AWS_FRONTEND_DEPLOY_ROLE_ARN`, `CLOUDFRONT_DISTRIBUTION_ID`.

### Hosts

- dev: `https://<distribution>.cloudfront.net` (default domain).
- prod: `https://<distribution>.cloudfront.net` (default domain; dominio custom diferido).
- Cuando se defina dominio custom, se actualizara esta seccion y README sin cambiar nombres de bucket ni nombres de secret.

### Rollback

- Re-run del workflow anterior desde Actions tab (mismo SHA, mismo env). El sync NO borra archivos previos, solo sobreescribe. Para rollback total: vaciar bucket y re-deployar tag anterior.
- Invalidation post-sync ya ocurre al final de cada deploy.

### Primer deploy (checklist)

1. Repo 02-infrastructure: `terraform apply` de `modules/frontend-hosting` + `modules/oidc-frontend` en env dev. Confirmar outputs (`bucket_name`, `distribution_id`, `role_arn` por env).
2. Repo 01-devops: merge del PR que crea `reusable-frontend-deploy.yml` con la firma documentada en la seccion "Contratos publicados" de este PR. Verificar bats tests en verde.
3. Repo 04-frontend settings -> Environments:
   - Crear `development` (sin required reviewers). Agregar secrets `AWS_FRONTEND_DEPLOY_ROLE_ARN` y `CLOUDFRONT_DISTRIBUTION_ID` con valores de dev.
   - Crear `production` (required reviewers = `@spark-match/frontend-devs` + `@spark-match/product-owners`). Agregar los mismos dos secrets con valores de prod.
4. Actions tab -> Deploy dry run -> Run workflow en rama `dev`. Verificar logs.
5. Si dry-run OK, push a `dev` dispara deploy automatico.
6. Smoke test: `curl -I https://<distribution>.cloudfront.net/` debe devolver 200 con cache-control del HTML. Probar deep links `/home`, `/filters`, `/assessment` (no deben dar 404, el error response de CloudFront devuelve index.html con 200).

### Known issues

- Hasta que `reusable-frontend-deploy.yml` exista en 01-devops con la firma documentada, el primer run de `deploy.yml` fallara. Esto es esperado y NO bloquea el merge del frontend: el primer run sera el smoke test del contrato.

### Contratos publicados (inputs que 02-infrastructure y 01-devops deben implementar)

| Contrato | Valor | Owner |
|---|---|---|
| Bucket S3 dev | `spark-match-frontend-dev` | 02-infrastructure |
| Bucket S3 prod | `spark-match-frontend-prod` | 02-infrastructure |
| Region | `us-east-1` | 02-infrastructure |
| Path en S3 | raiz del bucket | 02-infrastructure |
| Role OIDC dev | `spark-match-frontend-deploy-dev`, trust = `ref:refs/heads/dev` + `environment:development` | 02-infrastructure |
| Role OIDC prod | `spark-match-frontend-deploy-prod`, trust = `ref:refs/heads/main` + `environment:production` | 02-infrastructure |
| Permisos role | `s3:*` sobre su bucket + access-logs; `cloudfront:CreateInvalidation/Get/List` | 02-infrastructure |
| Reusable | `reusable-frontend-deploy.yml@main` con inputs: `environment-name`, `aws-region`, `role-arn`, `working-directory`, `build-script`, `node-version`, `bucket-name`, `distribution-id`, `source-dir`, `cache-control-hashed`, `cache-control-html`, `invalidation-paths`, `dry-run` (opcional) | 01-devops |
| Cache hashed | `public, max-age=31536000, immutable` | 01-devops |
| Cache html | `no-cache, no-store, must-revalidate` | 01-devops |
| Invalidation | `--paths "/*"` | 01-devops |
| Sin dominio custom | el endpoint es `*.cloudfront.net` default | N/A (defer) |

## Verificacion local pre-PR

- `npm run typecheck`
- `npm run lint`
- `npm run build -- --configuration=production`
- `npm run predeploy:check` (debe pasar todos los checks duros)
- `npm test -- --watch=false --coverage` (verificar que no baja de thresholds en angular.json)
