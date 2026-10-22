# Verify — sitio-publico-busqueda (F-19, más subgéneros de música)

- Fecha: 2026-10-22
- Track: app
- Commit verificado: c99bc3d (+ cambios del working tree de `feat/generos-musica-2`)

## Comandos ejecutados
- `npm run lint:spec` → ✅ (spec válido; 1 warning preexistente de `/health` sin `security`)
- `npm run generate:types` + `git diff --exit-code packages/shared/src/types/openapi.d.ts` → ✅ (sin drift)
- `npm run generate:schemas` → ✅ (`schemas.ts` y `types.ts` regenerados, sin edición manual)
- `npm run type-check` → ✅ (0 errores)
- `npm test` → ✅ (46 archivos, 534 tests)
- `python -m unittest discover -s tests` en `ingestion/` → ✅ (187 tests)
- Paso 4.5 (smoke local): N/A — el slice no agrega ni modifica endpoints ni queries; el filtro por género es el mismo código que F-16/F-17 y se cubre con D1 real en `search.d1.test.ts`.
- Paso 5 (envelope) y Paso 6 (stores): N/A — sin cambios en `routes/` ni en stores.

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-16c (valores nuevos válidos, `reguetón`/`trap` → 400) | `search-validation.test.ts`: `[AC-16c] los géneros nuevos … no dan 400`, `[AC-16c] musica=%s es 400` | ✅ |
| AC-16c (metal no es alias de rock; pop entra, rock no) | `search-pipeline.test.ts`: `[AC-16c] géneros nuevos (F-19)` | ✅ |
| AC-16c (contra D1 real) | `search.d1.test.ts`: `[AC-16c] metal y pop contra datos reales` | ✅ |
| AC-16c (el sitio conserva los 5 valores, descarta `trap`) | `search-query.test.ts`: línea `[AC-16c]` en `parseSearch` | ✅ |
| Plan 5d (ingesta: palabras, `metal` fuera de `rock`, exclusiones de `pop`, `cuarteto` de Qué Hacemos) | `test_genres.py` (`test_generos_nuevos_f19`, `test_pop_con_exclusiones`, `test_genero_f19_en_el_campo_genero`), `test_ingesta.py` (`test_el_tipo_cuarteto_pasa_como_subgenero`) | ✅ |

Nota de RED: los tests de la API pasan desde el primer momento porque la validación importa el schema generado (`MusicGenreSchema`); el RED real de este slice estuvo en el sitio web (`GENRES`) y en la ingesta.

## Resultado
✅ verificado. Sin excepciones. Pendiente fuera del alcance: `/qa-visual` de los chips nuevos en el home (no se probó en navegador).
