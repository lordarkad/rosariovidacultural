# Verify — sitio-publico-detalle-lugar-api (slice 4b-1)

- Fecha: 2026-10-19
- Track: app
- Commit verificado: 1fc8864 (main) + cambios del slice sin commitear al momento de verificar

## Comandos ejecutados
- `npm run lint:spec` → ✅ (spec válido; sin cambios en `docs/api-spec.yml`, ya mergeado en #46)
- `npm run generate:types` + diff de `packages/shared/src/types/openapi.d.ts` → ✅ sin drift (solo avisos de fin de línea)
- `npm run generate:schemas` → regenerado `packages/shared/src/schemas.ts` (`PlaceDetail.next_change_at`, `UpcomingEvent.end_date`); `types.ts` derivado sin cambios
- `npm run type-check` → ✅
- `npm test` → ✅ (371 tests, 35 archivos)
- `python -m unittest discover -s tests` (desde `ingestion/`) → ✅ (169 tests)
- Paso 4.5 (smoke real contra `wrangler dev` local, D1 local con migraciones, `getPlace` hace `JOIN`): ✅
  - `POST /api/ingest` con un lugar 24/7 de cocina traducida y un evento en curso hasta 2099 → 200, 1 lugar y 1 evento creados.
  - `GET /api/places/{id}` → 200 con envelope; `open_now: true`, `next_change_at: null` (24/7), `cuisine: ["café","pizza italiana"]`, `upcoming_events[0].end_date: "2099-12-31"` (rango en curso, `start_date: "2026-10-01"`).
  - `GET /api/places/<uuid inexistente>` → 404 `{ success: false, error }`; `GET /api/places/no-es-uuid` → 400 `{ success: false, error }`.
  - Restauración: se borraron el lugar y el evento sembrados (por `source_key` `smoke:%`) y se eliminó el `.dev.vars` temporal (ignorado por git); `wrangler dev` detenido.
- Paso 5 (envelope): el slice no agrega endpoints ni cambia respuestas de error; el contrato ya lo valida `lint:spec`. Paso 6 (stores del dashboard): N/A, no toca `apps/dashboard`.

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-1 | `next-state-change.test.ts` `[AC-1]`; `detail.d1.test.ts` `[AC-1]` | ✅ |
| AC-2 | `next-state-change.test.ts` `[AC-2]`; `detail.d1.test.ts` `[AC-2]` | ✅ |
| AC-3 | `next-state-change.test.ts` `[AC-3]` | ✅ |
| AC-4 | `next-state-change.test.ts` `[AC-4]` | ✅ |
| AC-5 | `next-state-change.test.ts` `[AC-5]`; `detail.d1.test.ts` `[AC-5]` | ✅ |
| AC-6 | `next-state-change.test.ts` `[AC-6]` | ✅ |
| AC-6b | `next-state-change.test.ts` `[AC-6b]` | ✅ |
| AC-7 | `next-state-change.test.ts` `[AC-7]`; `detail.d1.test.ts` `[AC-7][AC-8]` | ✅ |
| AC-8 | `detail.d1.test.ts` `[AC-7][AC-8]` (clave presente y valida contra `PlaceDetailSchema`) | ✅ |
| AC-9 | `detail.d1.test.ts` `[AC-9]` y el `toEqual` de `upcoming_events[0]` con `end_date` | ✅ |
| AC-10 | `test_cuisine.py` `[AC-10]` | ✅ |
| AC-11 | `test_cuisine.py` `[AC-11]` | ✅ |
| AC-12 | `test_cuisine.py` `[AC-12]` | ✅ |
| AC-13 | `test_cuisine.py` `[AC-13]`; `ingest.d1.test.ts` `[AC-13]` | ✅ |
| AC-14 | [Manual] reingesta y verificación en staging/producción tras el deploy | pendiente (post-merge) |

## Notas
- El AC-11 usaba `peruvian` como ejemplo de valor desconocido, pero está en `places.json` y el diccionario completo lo traduce («peruana»); se cambió el ejemplo a `thai` en `docs/changes/sitio-publico-detalle-lugar-api.md`. La regla no cambia.
- El diccionario cubre los 75 valores distintos de `places.json` (verificado: ninguno sin traducir).
- Snyk: no autenticado (`snyk_auth` es interactivo), no se escaneó.

## Resultado
✅ verificado, con AC-14 manual pendiente de la reingesta post-deploy.
