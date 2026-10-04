# Verify — sitio-publico-busqueda (Slice 1: catálogo y búsqueda)

- Fecha: 2026-10-02
- Track: app
- Commit verificado: 1c453a4 (tope de la pila de PRs #6..#12; reemplaza la corrida anterior sobre f289af6)

## Comandos ejecutados
- `npm run lint:spec` → ✅ (spec válido, 1 warning previo: `/health` sin `security`; y 1 warning de la config de Redocly)
- `npm run generate:schemas` + `git diff --exit-code packages/shared/src/schemas.ts types.ts` → ✅ sin drift
- `npm run type-check` → ✅ (0 errores)
- `npm test` (desde la raíz) → ✅ 238 tests, 22 archivos (proyectos `api`, `api-d1` con D1 real, `dashboard`)
- Búsqueda de AC sin test citado (AC-1..AC-39) → ✅ ninguno sin citar
- Verificación de envelope: sin `c.json(...)` sin `success` en `routes/`, `index.ts` ni `middleware/` → ✅ (`validate_envelope` MCP no disponible en la sesión; se hizo a mano)
- Smoke real contra `wrangler dev` en local (D1 local, migraciones ya aplicadas) → ✅ ver tabla

## Cobertura de AC
Los 40 AC (AC-1..AC-39 y AC-10b) tienen al menos un test que los cita por nombre.

| AC | Archivo de test |
|---|---|
| AC-1 | `zones.d1.test.ts`, `migration.d1.test.ts` |
| AC-2, 6, 18, 19, 20, 21 | `search.d1.test.ts` |
| AC-3 | `search-pipeline.test.ts`, `geo.test.ts`, `search.d1.test.ts` |
| AC-4, 7, 14, 15, 16 | `search-pipeline.test.ts` (y `search.d1.test.ts` para 14 y 16) |
| AC-5 | `search-validation.test.ts`, `windows.test.ts` |
| AC-8, 9, 10, 10b, 11, 12 | `bands.test.ts`, `time.test.ts` |
| AC-13 | `windows.test.ts`, `opening-hours.test.ts` |
| AC-17 | `opening-hours.test.ts`, `bands.test.ts`, `search.d1.test.ts` |
| AC-22, 23 | `pins.d1.test.ts`, `geo.test.ts`, `search-validation.test.ts` |
| AC-24, 25, 26, 27, 28 | `detail.d1.test.ts`, `detail-validation.test.ts`, `occurrences.test.ts` |
| AC-29, 30, 33, 34, 35 | `ingest.d1.test.ts`, `validate-items.test.ts` |
| AC-31 | `ingest-auth.test.ts` |
| AC-32 | `ingest-validation.test.ts` |
| AC-36, 37, 38, 39 | `plan-events.test.ts`, `plan-places.test.ts`, `ingest.d1.test.ts`, `detail.d1.test.ts` |

## Smoke real (Paso 4.5)
| Operación | Request | Esperado | Obtenido |
|---|---|---|---|
| listZones | `GET /api/zones` | 200 | 200 ✅ |
| ingestBatch | sin token / token incorrecto | 401 | 401 ✅ |
| ingestBatch | body `{"source":1}` | 400 | 400 ✅ |
| ingestBatch | lote con 1 lugar y 1 evento | 200, `created` 1+1 | 200 ✅ |
| ingestBatch | mismo lote otra vez | 200, `created` 0, `updated` 1+1 | 200 ✅ |
| searchItems | `?cuando=fecha&fecha=2026-10-07` | 200 con el evento | 200 ✅ |
| searchItems | `?q=lugar` | 200 con el lugar | 200 ✅ |
| searchItems | `?z=centro&cuando=fecha&fecha=2026-10-07` | 200 vacío (el lugar queda a ~1,26 km, fuera del radio de 1200 m) | 200 ✅ |
| searchItems | fecha pasada / `lat` sin `lon` | 400 / 400 | 400 / 400 ✅ |
| searchPins | `?cuando=fecha&fecha=2026-10-07` | 200 | 200 ✅ |
| getEvent | existente / inexistente / id no UUID | 200 / 404 / 400 | 200 / 404 / 400 ✅ |
| getPlace | existente / inexistente | 200 / 404 | 200 / 404 ✅ |
| (ruta inexistente) | `GET /api/nada` | 404 con envelope | 404 ✅ |

Alcance del smoke: es más acotado que el de la corrida anterior (22 checks sobre f289af6). No repitió, por ejemplo, el lote con un evento roto ni los casos de zona inexistente, `per_page=101` y bbox invertido; esos siguen cubiertos por los tests (`ingest.d1.test.ts`, `search-validation.test.ts`, `pins.d1.test.ts`).

Estado previo de D1 local: zones 13, places/events/place_keys/event_sources 0. Estado posterior a la restauración: zones 13, el resto 0 (coincide: sí). El `.dev.vars` de prueba (gitignored) se borró.

## Observación (no bloqueante)
En el smoke, un evento con `venue_name` igual al nombre de un lugar ingerido en el mismo lote quedó sin vincular (`place: null`, `location_known: false`). Es coherente con que el vínculo se haga por clave de lugar y no por nombre, pero conviene confirmarlo contra el spec cuando se defina el sub-slice Python de `ingestion/`.

## Paso 6 (stores) y Paso 7 (deploy)
N/A: el slice no toca `apps/dashboard` y no se investiga un problema de producción.

## Resultado
✅ verificado sobre 1c453a4. Este commit tiene el mismo árbol que a729a2a (verificado antes del restack).
