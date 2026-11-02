# rosariovidacultural

Agregador de planes en Rosario (eventos, espacios y lugares): sitio público y panel de administración. Track App de Triptongo con un componente de ingesta en Python.

## Componentes

| Ruta | Contenido |
|---|---|
| `apps/api` | API Hono sobre Workers, migraciones D1 (catálogo, fuentes de eventos, lugares) |
| `apps/web` | Sitio público |
| `apps/dashboard` | Panel de administración (Vue 3) |
| `packages/shared` | Tipos y schemas generados desde el spec |
| `ingestion/` | Scrapers en Python de 11 fuentes; publican a la API por un endpoint de ingesta autenticado |
| `docs` | Spec OpenAPI, ADRs, requisitos y tokens de diseño |
| `wireframes` | Wireframes del owner |

La API expone zonas, búsqueda (incluye pines de mapa), eventos y sus fuentes, lugares e ingesta. Los scrapers corren en GitHub Actions (ADR 0002).

## Desarrollo

```bash
npm install
npm run dev:api
npm run dev:dashboard
npm run dev:web
npm test
npm run type-check
npm run lint:spec
npm run generate:types
npm run generate:schemas

# ingesta (desde ingestion/)
python -m unittest discover -s tests
```

## Despliegue

Entornos staging y production, por app: `deploy:api:staging`, `deploy:api:production`, `deploy:dashboard:*`, `deploy:web:*`. El `CLOUDFLARE_ACCOUNT_ID` se define por variable de entorno, nunca en archivos del repo.

## Proceso

Sigue el Track App de `triptongo-dev-playbook` (spec antes que código). Ver `CLAUDE.md` y `docs/adr/`.
