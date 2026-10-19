# Verify — sitio-publico-detalle-lugar

- Fecha: 2026-10-19
- Track: app
- Commit verificado: e920f5c + cambios del slice 4b-2 sin commitear (el reporte entra en el mismo commit)

## Comandos ejecutados
- `npm run lint:spec` → ✅ (1 warning preexistente)
- `npm run type-check` → ✅ (4 workspaces, sin errores)
- `npm test` → ✅ (422 tests, 38 archivos)
- `generate:types` / drift: N/A (el slice no toca `docs/api-spec.yml`)
- Smoke local (Paso 4.5): N/A (solo `apps/web`, sin endpoints nuevos)
- Stores (Paso 6): `place.store` con `loading`/`error`/`notFound` obligatorios, `loading = false` en `finally`, errores capturados → ✅

## Cobertura de AC
| AC | Test(s) que lo citan | Resultado |
|---|---|---|
| AC-1 | `lugar-view`, `detail-lib` | ✅ |
| AC-2 | `detail-lib` (`detailLink`) | ✅ |
| AC-3 | `api`, `detail-lib`, `lugar-view` | ✅ |
| AC-4 | `place.store`, `lugar-view` | ✅ |
| AC-5 | `place-lib` (`openStatus`), `lugar-view` | ✅ |
| AC-6 | `place-lib` (`weekSchedule`), `lugar-view` | ✅ |
| AC-7 | `place-lib`, `lugar-view` | ✅ |
| AC-8 | `lugar-view` | ✅ |
| AC-9 | `place-lib`, `lugar-view` | ✅ |
| AC-10 | `lugar-view` | ✅ |
| AC-11 | `lugar-view` | ✅ |
| AC-12 | `lugar-view` | ✅ |
| AC-13 | `lugar-view` | ✅ |
| AC-14 | `detail-lib`, `evento-view` | ✅ |
| AC-15 | `evento-view` | ✅ |
| AC-16 | `detail-lib` (`activeTab` con `meta.tab`) | ✅ |

## QA visual (subagente `qa-visual`, dev server local contra staging, con capturas revisadas)
- ✅ Entrada directa mobile 390 y desktop 1280: h1, etiquetas, cocina, estado de horario, semana plegada con «(hoy)», dirección, Cómo llegar / Llamar / Sitio / Instagram según existan, atribución OSM.
- ✅ Placeholder de imagen con ratio reservado; sin overflow.
- ✅ 404 y id inválido: «No encontramos este lugar» con «Ver resultados» y «Volver al inicio».
- ✅ Resultados → lugar sin `lat`/`lon` en la URL, «Distancia» presente, se conserva tras recargar; «Volver» vuelve a Resultados.
- ✅ Foco al `h1` y título de la pestaña; consola sin errores propios.
- Hallazgo corregido: faltaba el espacio entre «●» y «Abierto» (`mr-1`).
- ⚠️ No verificados: modo oscuro (sin emulación de `prefers-color-scheme`), `aria-current` de la pestaña en navegador (cubierto por `activeTab`), lugar con teléfono+web+Instagram a la vez, cerrado/«abre …» y 24 h (staging solo tenía lugares abiertos), mapa/MapTiler (la ficha no lleva mapa).

## Code review
Un agente `tript-code-reviewer` sobre el diff: sin hallazgos ≥80. Dos notas menores aplicadas (`aria-hidden` en los glifos del botón de semana; se quitó `aria-controls` que apuntaba a un nodo ausente).

## Resultado
⚠️ verificado con excepciones documentadas arriba (modo oscuro y los casos de horario cerrado/24 h solo cubiertos por tests unitarios).
