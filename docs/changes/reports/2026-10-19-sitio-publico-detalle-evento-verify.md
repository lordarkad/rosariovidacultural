# Verify — sitio-publico-detalle-evento

- Fecha: 2026-10-19
- Track: app
- Commit verificado: a9a9ab0 (main) + cambios del slice sin commitear al momento de verificar

## Comandos ejecutados
- `npm run lint:spec` → ✅ (spec válido; sin cambios en `docs/api-spec.yml`)
- `npm run generate:types` + `git diff --exit-code packages/shared/src/types/openapi.d.ts` → ✅ sin drift (solo avisos de fin de línea)
- `npm run type-check` → ✅
- `npm test` → ✅ (356 tests, 34 archivos)
- Pasos 4.5 (smoke local), 5 (envelope) y 6 (stores del dashboard): N/A — el slice es solo `apps/web`, sin endpoints nuevos ni cambios en `apps/api`. El `detail.store` cumple `loading`/`error` y se prueba en `detail.store.test.ts`.

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-1 | ruta `/e/:id` en `router/index.ts`; `detailLink` devuelve `null` para lugares (`[AC-2]`); `/l/:id` sigue en el comodín 404 | ✅ + navegador |
| AC-2 | `detail-lib.test.ts` `[AC-2]` | ✅ |
| AC-3 | `detail-lib.test.ts` `[AC-3]` | ✅ |
| AC-4 | `api.test.ts` `[AC-4]`, `detail-lib.test.ts` `[AC-3][AC-4]` | ✅ |
| AC-5 | `detail.store.test.ts` `[AC-5]` | ✅ |
| AC-6 | `detail-lib.test.ts` `[AC-6]` | ✅ |
| AC-7 | `formatPrice`/`formatDistance`/`formatWalk` reutilizados (testeados en `format.test.ts`); «precio no informado» en la vista | ✅ + navegador |
| AC-8 | `detail-lib.test.ts` `[AC-8]` | ✅ |
| AC-9 | `evento-view.test.ts` `[AC-9]` | ✅ |
| AC-10 | `detail-lib.test.ts` `[AC-10]` | ✅ |
| AC-11 | `evento-view.test.ts` `[AC-11]` | ✅ |
| AC-12 | `detail-lib.test.ts` `[AC-12]` (truncado); texto plano por `{{ }}` + `whitespace-pre-line` | ✅ |
| AC-13 | `evento-view.test.ts` `[AC-13]` | ✅ |
| AC-14 | `detail-lib.test.ts` `[AC-14]` | ✅ |
| AC-15 | `detail-lib.test.ts` `[AC-15]` | ✅ |

## Resultado
✅ verificado. Pendiente aparte: verificación en navegador con capturas (`/qa-visual`) y `/code-review`.
