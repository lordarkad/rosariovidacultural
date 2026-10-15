# Verify — sitio-publico-busqueda (subgéneros de música, F-17)

- Fecha: 2026-10-15
- Track: app
- Commit base verificado: 127f9f7 (main, spec PR #22 mergeado) + cambios sin commitear de `feat/subgeneros-musica`

## Comandos ejecutados
- `npm run lint:spec` → ✅ (válido; una advertencia `security-defined` en `/health`, preexistente)
- `npm run generate:types` + `git diff --ignore-space-at-eol` sobre `openapi.d.ts` → ✅ sin drift (solo difiere el fin de línea; se restauró el archivo)
- `npm run generate:schemas` → `schemas.ts` regenerado con los 4 géneros nuevos (4 líneas); `types.ts` sin cambios
- `npm run type-check` → ✅
- `npm test` → ✅ (243 tests, 22 archivos; 3 tests nuevos en RED antes de implementar)
- `python -m unittest discover -s tests` (desde `ingestion/`) → ✅ (70 tests; 9 nuevos en `test_genres.py`)
- Snyk Code sobre el repo → 1 hallazgo (ReDoS, `ingestion/site/index.html`, sitio legacy sin tocar); sin hallazgos en el código nuevo

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-16 (ejemplo inválido `vallenato`) | `search-validation.test.ts` `[AC-16] musica con género fuera del enum es 400…`; `search-pipeline.test.ts` `[AC-16] …` | ✅ |
| AC-16b | `search-pipeline.test.ts` (3 casos: `i=bailar`, `i=bailar,musica_en_vivo`, `i=comer`); `search-validation.test.ts` `[AC-16b] los subgéneros nuevos … no dan 400`; `search.d1.test.ts` `[AC-16b] tango con bailar contra datos reales` | ✅ |
| AC-23 / validación de `searchPins` | `search-validation.test.ts` `[AC-23] mismas validaciones que search: género` (ahora con `vallenato`) | ✅ |

## Smoke real (Paso 4.5)
No se corrió `wrangler dev` con `curl`. El cambio toca la lógica pura del filtro (`search-pipeline.ts`) y el enum de validación, y no agrega ni modifica queries ni muta datos. El caso con SQL real está cubierto por `search.d1.test.ts` (`@cloudflare/vitest-pool-workers`, migraciones aplicadas), que ejecuta `/api/search` contra D1 real con el escenario de AC-16b.

## Envelope y stores
- Envelope: el diff no toca rutas ni respuestas; `docs/api-spec.yml` solo cambió el enum y las descripciones (PR #22).
- Stores: N/A, el slice no toca el dashboard.

## Fuera de lo verificado
- `guess_genres` y el campo `genres` del espacio (Python) quedan implementados y testeados pero **sin conectar** al publicador de `/ingest`: esa conexión depende de B-3 (clasificar `intents`), que sigue pendiente.
- El wireframe `home.html` se actualizó (chips Tango, Cumbia, Clásica, Chamamé) sin revisión visual en navegador.

## Resultado
✅ verificado, con la excepción documentada del smoke local (cubierto por los tests contra D1 real).
