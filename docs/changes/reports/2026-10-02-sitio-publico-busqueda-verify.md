# Verify — sitio-publico-busqueda (Slice 1: catálogo y búsqueda)

- Fecha: 2026-10-02
- Track: app
- Commit verificado: f289af6

## Comandos ejecutados
- `npm run lint:spec` → ✅ (spec válido, 1 warning previo: `/health` sin `security`)
- `npm run generate:schemas` + diff ignorando fin de línea sobre `packages/shared/src/schemas.ts` → ✅ sin drift
- `npm run type-check` → ✅ (0 errores, `apps/api` y `apps/dashboard`)
- `npm test` (desde la raíz) → ✅ 235 tests, 22 archivos (proyectos `api`, `api-d1` con D1 real, `dashboard`)
- Snyk Code sobre `scripts/`, `apps/api/src` → ✅ 0 issues en cada bloque
- Smoke real contra `wrangler dev` (D1 local, migraciones aplicadas con el runner de Wrangler) → ✅ 22/22

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
| ingestBatch | sin token / token malo | 401 | 401 ✅ |
| ingestBatch | JSON malformado / sin `source` | 400 | 400 ✅ |
| ingestBatch | lote con 1 lugar, 2 eventos (1 roto) | 200, `rejected` 1 | 200 ✅ |
| ingestBatch | mismo lote otra vez | 200, `created` 0 | 200 ✅ |
| listZones | `GET /api/zones` | 200 | 200 ✅ |
| searchItems | `?z=pichincha&cuando=hoy` (JOIN lugar-evento) | 200 | 200 ✅ |
| searchItems | zona inexistente / `z`+`lat` / `per_page=101` | 404 / 400 / 400 | ✅ |
| searchPins | `?z=pichincha` / bbox invertido | 200 / 400 | ✅ |
| getEvent | con `lat`/`lon`, inexistente, no UUID, `lat` sin `lon` | 200 / 404 / 400 / 400 | ✅ |
| getPlace | existente, inexistente | 200 / 404 | ✅ |

Estado previo de D1 local: zones 13, el resto 0. Estado posterior a la restauración: zones 13, el resto 0 (coincide: sí). El `.dev.vars` de prueba (gitignored) se borró.

## Resultado
✅ verificado. El `/code-review` posterior (4 focos) no cambió el código de este commit.
