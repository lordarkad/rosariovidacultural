# Verify — sitio-publico-busqueda (F-18 / AC-40, lugar heredado de alias, E-10)

- Fecha: 2026-10-17
- Track: app
- Commit verificado: bac6463 (base `main`) más los cambios sin commitear de la rama `feat/e10-lugar-heredado`

## Comandos ejecutados
- `npm run lint:spec` → ✅ (1 warning previo: `security-defined` en `/health`)
- `npm run generate:types` + `git diff --ignore-cr-at-eol --exit-code packages/shared/src/types/openapi.d.ts` → ✅ sin drift (el spec no cambió en este slice)
- `npm run type-check` → ✅ (0 errores)
- `npm test` → ✅ (258 tests, 23 archivos; incluye los D1 reales con `@cloudflare/vitest-pool-workers`)
- Smoke local (Paso 4.5) con `wrangler dev --port 8799` y D1 local → ✅ (ver abajo)

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-40 caso A (y variante con orden inverso) | `plan-events-lugar-heredado.test.ts` `[AC-40] caso A…` (2 tests); `ingest.d1.test.ts` `[AC-40] caso A: getEvent devuelve el lugar del alias…` | ✅ |
| AC-40 caso B | `[AC-40] caso B: gana la canónica, también si su lugar todavía no está cargado` | ✅ |
| AC-40 caso C | `[AC-40] caso C…` (unitario) y `[AC-40] caso A: reenviar el alias… (reenvío completa)` (D1 real) | ✅ |
| AC-40 caso D | `[AC-40] caso D…` | ✅ |
| AC-40 caso E | `[AC-40] caso E…` | ✅ |
| AC-40 caso F (tier, igual tier con filas absorbidas, reenvío del ganador) | 3 tests `[AC-40] caso F…` | ✅ |
| AC-40 caso G | `[AC-40] caso G…` | ✅ |
| AC-40 caso H | `[AC-40] caso H…` | ✅ |
| AC-40 caso I | `[AC-40] caso I…` | ✅ |
| Backfill de la migración 0002 (tarea 5c(a)) | `ingest.d1.test.ts` `[AC-40] el backfill de 0002…` (corre el `UPDATE` real dos veces) | ✅ |

## Smoke real (Paso 4.5)
| operationId | Request | Esperado | Obtenido |
|---|---|---|---|
| ingestBatch | `POST /api/ingest` lugar curado | 200 + envelope, `places.created 1` | 200 ✅ |
| ingestBatch | `POST /api/ingest` evento `official` sin lugar | 200, `events.created 1` | 200 ✅ |
| ingestBatch | `POST /api/ingest` alias `aggregator` con `place_source_key` | 200, `events.updated 1`, `created 0` | 200 ✅ |
| getEvent | `GET /api/events/:id` del evento fusionado | 200 con `place` = el lugar del alias | 200, `place.name = "Smoke Casa"` ✅ |
| getEvent | `GET /api/events/<uuid inexistente>` | 404 + envelope de error | 404 ✅ |
| ingestBatch | sin `Authorization` | 401 + envelope | 401 ✅ |
| ingestBatch | lote sin `source.tier` ni `generated_at` | 400 + envelope | 400 ✅ |

`event_sources` quedó con `smoke:agg` → `smoke:p1` y `smoke:ofi` → `NULL`, como define F-18.

Estado previo de D1 local: events 0, event_sources 0, places 0, place_keys 0. Estado posterior a la restauración: events 0, event_sources 0, places 0, place_keys 0 (coincide: sí). Se aplicó la migración `0002` en el D1 local, se borró el `.dev.vars` temporal y se detuvo el Worker.

## Otros pasos
- Paso 5 (envelope): `validate_envelope` no disponible. Verificación manual: el slice no agrega ni cambia rutas ni respuestas (el diff no toca `routes/`), y los `curl` de arriba confirman el envelope en 200, 400, 401 y 404.
- Paso 6 (stores): N/A, el slice no toca el dashboard.
- Paso 7: N/A, no se investigaba un problema de producción.

## Resultado
✅ verificado
