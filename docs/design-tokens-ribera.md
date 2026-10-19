# Tokens de la dirección B · Ribera

- **Fuente:** Figma Make `en5jOAjdZvfWxOggie0jUt`, archivo `src/rq/tokens.ts`, variante `B`. Leído el 2026-10-18.
- **Uso:** referencia para `apps/web` (decisión S2-9 de `docs/changes/sitio-publico-busqueda.md`). Se copian tal cual, salvo el ajuste de `docs/DESIGN.md`: se elimina `type-espacio` (B-1b).
- **Capas:** primitivos → semánticos (claro/oscuro) → por componente. Los componentes leen solo variables semánticas o de componente (`--rq-*`), nunca un primitivo.
- Las variantes A, C, D, E y F del Make son exploraciones descartadas: no se usan.

## Tipografía

| Rol | Familia | Notas |
|---|---|---|
| Títulos (`--rq-font-display`) | Young Serif | peso 400, tracking `-0.01em` |
| Cuerpo y meta (`--rq-font-body`, `--rq-font-meta`) | Schibsted Grotesk | pesos 400–800; meta en mayúsculas, tracking `0.1em`, 11 px |

Google Fonts: `family=Young+Serif&family=Schibsted+Grotesk:wght@400;500;600;700;800`.

## Primitivos

| Grupo | Valores |
|---|---|
| arena | 50 `#F5F1E6` · 100 `#ECE6D5` · 200 `#DDD4BD` · 300 `#C7BC9F` |
| rio | 950 `#0B1C15` · 900 `#10261E` · 800 `#173529` · 700 `#22493A` · 500 `#4A6A5B` · 300 `#9DBDAA` |
| ladrillo | 600 `#A4472A` · 300 `#E7A588` |
| cielo | 700 `#2E5A76` · 300 `#9CC6E0` |
| sábalo (primario) | 50 `#FFFBE8` · 100 `#FFF3C2` · 200 `#FFE789` · 300 `#FDDA4F` · 400 `#F7CE2D` · 500 `#F2BE00` · 600 `#C99A00` · 700 `#9C7600` · 800 `#6B5200` · 900 `#473600` · 950 `#261D00` |

## Semánticos

| Token | Claro | Oscuro |
|---|---|---|
| `surface-0` | `#F5F1E6` | `#0B1C15` |
| `surface-50` | `#ECE6D5` | `#10261E` |
| `surface-100` | `#DDD4BD` | `#173529` |
| `surface-card` | `#FFFDF7` | `#10261E` |
| `surface-inverse` | `#10261E` | `#F5F1E6` |
| `text` | `#10261E` | `#F5F1E6` |
| `text-muted` | `#3F5549` | `#B7C7BC` |
| `text-inverse` | `#F5F1E6` | `#10261E` |
| `text-on-primary` | `#10261E` | `#10261E` |
| `border` | `#C7BC9F` | `#2C5242` |
| `border-strong` | `#10261E` | `#F5F1E6` |
| `primary` | `#F2BE00` | `#F7CE2D` |
| `primary-hover` | `#F7CE2D` | `#FDDA4F` |
| `primary-soft` | `#FFF3C2` | `#473600` |
| `focus` | `#10261E` | `#F7CE2D` |
| `type-evento` | `#A4472A` | `#E7A588` |
| `type-lugar` | `#2E5A76` | `#9CC6E0` |
| `warn-bg` / `warn-text` | `#FFF3C2` / `#473600` | `#3A2F06` / `#FFE789` |
| `danger-bg` / `danger-text` | `#F4D6C9` / `#6E2A14` | `#3E1C12` / `#F4B9A2` |
| `map-land` | `#E6DFCB` | `#10261E` |
| `map-water` | `#A9C3B4` | `#07130E` |
| `map-street` | `#F5F1E6` | `#1E3E31` |
| `map-park` | `#C9D7B5` | `#15392A` |
| `map-label` | `#3F5549` | `#B7C7BC` |

`type-espacio` (claro `#22493A`, oscuro `#9DBDAA`) existe en el Make pero **no se usa** (B-1b).

## Por componente

| Token | Valor |
|---|---|
| `radius-chip` | 12 px |
| `radius-card` | 16 px |
| `radius-sheet` | 24 px |
| `radius-button` | 14 px |
| `radius-tag` | 8 px |
| `radius-input` | 14 px |
| `chip-border-width` | 1,5 px |
| `display-weight` / `display-style` / `display-tracking` | 400 / normal / `-0.01em` |
| `meta-transform` / `meta-tracking` / `meta-size` | uppercase / `0.1em` / 11 px |
| `space-unit` | 4 px |

## Nota de accesibilidad (a resolver al implementar)

El amarillo `primary` (`#F2BE00`) sobre `surface-0` claro (`#F5F1E6`) tiene un contraste cercano a 1,5:1, muy por debajo de 3:1. Sirve como **fondo** de botones y chips (con `text-on-primary`), no como color de texto, de ícono ni de borde sobre fondo claro. En esos usos conviene `text` o `border-strong`. Verificar los pares reales con una herramienta de contraste durante el slice 5 (accesibilidad).
