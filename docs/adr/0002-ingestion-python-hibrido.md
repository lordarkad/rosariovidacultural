# ADR 0002 — Ingesta en Python (desviación del stack Track App)

- **Estado:** Propuesto · 2026-09-29 (pendiente de aprobación de Daniel)

## Contexto

El Track App fija Cloudflare Workers + TypeScript para toda la API. El proyecto nació como un agregador
estático en Python: 11 scrapers (~1900 líneas), 61 tests, parsers de fechas en texto libre y cachés de
geocodificación. Reescribirlos en TS implica re-validar cada fuente (Cinemark, Showcase, Cartel, etc.).

## Decisión

- Los scrapers **siguen en Python** en `ingestion/`, ejecutados por GitHub Actions (cron nocturno).
- Ya no commitean JSON al repo como salida final: publican a la API vía un endpoint de ingesta
  autenticado con `INGEST_TOKEN` (Wrangler Secret en el Worker, GH Actions Secret en el runner).
- El endpoint de ingesta **se define primero en `docs/api-spec.yml`** (`/ff`), como cualquier otro:
  envelope canónico, validación Zod, migraciones D1 para las tablas.
- Todo lo demás (API, dashboard, contratos, CI) sigue el Track App sin desvíos.

## Consecuencias

- El repo tiene dos toolchains (npm + pip); CI corre los tests de ambos.
- `ingestion/site/` (sitio estático legacy) queda como referencia hasta que el dashboard lo reemplace, y
  se elimina después.
- Si más adelante conviene migrar fuentes a Workers + Cron Triggers, se hace fuente por fuente vía nuevo ADR.
