# ADR 0002 — Ingesta en Python (desviación del stack Track App)

- **Estado:** Aceptado · 2026-09-30 (aprobado por Daniel; propuesto el 2026-09-29)

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
- **Costo de GitHub Actions:** el repo es público, así que los runners estándar no consumen minutos
  facturables. Aun así, el job de scrape tiene `timeout-minutes: 30` para acotar cuelgues, y se revisa el
  consumo real tras la primera semana de corridas.
- **Cron en repo público:** GitHub desactiva los workflows programados tras 60 días sin actividad en el repo.
  Mientras el repo tenga actividad no aplica; si pasa, reactivar el workflow a mano.
- **Código visible:** al ser público, los scrapers (fuentes y métodos) quedan a la vista. Nunca van secretos
  en el repo: `INGEST_TOKEN` solo como Secret.
- **Pendiente para `/ff`:** definir en el spec del endpoint de ingesta si un lote se acepta completo o parcial.
