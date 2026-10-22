# Slice 5 · Pulido de UI (listado de curación + contraste y fuentes del sitio)

Pedido del owner (2026-10-22): cerrar los pendientes de accesibilidad y performance que quedaron diferidos al QA de staging del listado de curación (PR #51/#52) y a la nota de accesibilidad de `docs/design-tokens-ribera.md`. **Solo front (`apps/web`)**: no cambia `docs/api-spec.yml`, ni datos, ni migraciones, así que no hay spec PR. Queda fuera conectar producción (API bajo el mismo dominio): es otro slice.

## Acceptance criteria

| AC | Criterio |
|---|---|
| AC-1 | Los checkboxes de filtros del listado tienen un área de toque de al menos 24×24 px (WCAG 2.5.8) y la etiqueta entera es clicable con alto mínimo de 44 px. |
| AC-2 | «Limpiar filtros», «Anterior», «Siguiente» y «Cancelar/Reintentar» usan texto y borde con contraste ≥ 4,5:1 / 3:1 en claro y oscuro: los botones `outlined` y `text` no usan el amarillo `primary` como color de texto ni de borde. |
| AC-3 | Los botones deshabilitados mantienen el texto con contraste ≥ 4,5:1 (opacidad 0,7). |
| AC-4 | Ningún indicador (pestaña activa, subrayado de enlaces) depende solo del amarillo `primary` sobre superficie clara: usan `border-strong`/`text`. |
| AC-5 | Los pares de tokens de texto del listado (`text`, `text-muted` sobre `surface-0`, `surface-card`, `primary-soft`; filas atenuadas) cumplen ≥ 4,5:1 en claro y oscuro; lo fija un test sobre `tokens.css`. |
| AC-6 | La hoja de Google Fonts no bloquea el primer render (carga diferida con `media="print"` + `onload`, y `<noscript>` de respaldo). |
| AC-7 | Escribir en el buscador no se pisa si la URL llega con retraso (el `watch` solo sobrescribe el campo ante un cambio externo: Atrás, «Limpiar filtros»). |
| AC-8 | «Limpiar filtros» y el cambio de página cancelan el temporizador pendiente del buscador. |

## Sin verificar a mano (pendiente del owner)

Scroll horizontal en mobile real y CSV abierto en Excel: las herramientas de QA no los cubren.
