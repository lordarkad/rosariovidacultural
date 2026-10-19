# Verify — curacion-listado

- Fecha: 2026-10-20
- Track: app
- Commit verificado: 09bd347 (spec, en main como 5f4d165) + cambios de la implementación sin commitear (el reporte entra en el mismo commit)

## Comandos ejecutados
- `npm run lint:spec` → ✅ (1 warning preexistente en `/health`)
- `npm run generate:types` / `npm run generate:schemas` → ✅ regenerados; el diff de `schemas.ts`, `types.ts` y `openapi.d.ts` es el esperado (los schemas del listado)
- `npm run type-check` → ✅ (4 workspaces, sin errores)
- `npm test` → ✅ (500 tests, 45 archivos)
- Smoke local con `wrangler dev` (Paso 4.5): no ejecutado. Las queries con `JOIN` se ejercitan contra D1 real con las migraciones aplicadas (`curation.d1.test.ts`, pool `@cloudflare/vitest-pool-workers`), que es el equivalente de [AC-21]
- Stores (Paso 6): `curation.store` con `loading`/`error` obligatorios, `loading = false` en `finally`, errores capturados, sin `throw` → ✅
- Snyk Code (`snyk code test apps --severity-threshold=medium`, CLI) → ✅ 0 issues

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-1 a AC-9, AC-12, AC-13 | `curation.d1.test.ts` (listEvents) | ✅ |
| AC-10, AC-11 | `curation.d1.test.ts` (paginación) y `curation-validation.test.ts` | ✅ |
| AC-14 | `curation.d1.test.ts` (`/events/sources` y métodos de escritura) | ✅ |
| AC-15 | `curation.d1.test.ts` (listEventSources) | ✅ |
| AC-16 a AC-20 | `curation.d1.test.ts` (listPlaces) | ✅ |
| AC-21 | `curation.d1.test.ts` (corre contra D1 real; combinaciones de todos los filtros) | ✅ |
| AC-22 | `curation-router.test.ts`, `curation-view.test.ts` (pestañas) | ✅ |
| AC-23 | `curation-lib.test.ts` (`_headers`, `setRobotsMeta`), `curation-router.test.ts` (`robotsGuard`) | ✅ |
| AC-24 | `curation-lib.test.ts`, `curation-api.test.ts`, `curation-view.test.ts` | ✅ |
| AC-25 | `curation.store.test.ts` | ✅ |
| AC-26 | `curation-view.test.ts` (cargando con esqueleto, sin resultados, vacío, error, recarga con filas) | ✅ |
| AC-27 | `curation-view.test.ts`, `curation-lib.test.ts` (`vistoLabel`) | ✅ |
| AC-28 | `curation-view.test.ts` | ✅ |
| AC-29, AC-30 | `curation.store.test.ts`, `curation-lib.test.ts` (nombre del archivo) | ✅ |
| AC-31 | `curation-lib.test.ts` | ✅ |
| AC-32 | **[Manual]** pendiente: con el slice en staging (QA visual con capturas, `curl -I` de `x-robots-tag`, CSV en Excel) | ⏳ |

## Code review
Un agente `tript-code-reviewer` sobre el diff: sin hallazgos críticos. Cuatro importantes, aplicados: faltaba un test que cite [AC-21] con combinaciones de filtros; el error de recarga se mostraba dos veces en eventos; el estado de carga era un texto y no un esqueleto; el buscador reemplazaba la entrada del historial en vez de agregarla. Aplicados además dos menores: el store se reinicia al cambiar de pestaña, y las filas pasadas se atenúan con `text-ink-muted` en vez de `opacity-60` (contraste AA).

## No verificado
- Contraste AA de las filas atenuadas y modo oscuro: requiere render (QA visual en staging).
- Lectura de los filtros y del CSV en un navegador real y en Excel.

## Resultado
⚠️ verificado con excepciones documentadas arriba (QA visual y Excel pendientes). El review aplicado sobre sus propios hallazgos no se re-ejecutó.
