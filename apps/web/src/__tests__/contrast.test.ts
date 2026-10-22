import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest corre siempre desde la raíz; el import `?raw` de CSS llega vacío bajo Vitest.
const css = readFileSync(resolve(process.cwd(), 'apps/web/src/assets/tokens.css'), 'utf-8')

/** Variables `--rq-*` de un bloque; el oscuro se superpone al claro como en el navegador. */
const vars = (block: string): Record<string, string> =>
  Object.fromEntries([...block.matchAll(/--rq-([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]))

const darkAt = css.indexOf('prefers-color-scheme: dark')
const light = vars(css.slice(0, darkAt))
const dark = { ...light, ...vars(css.slice(darkAt)) }

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const lum = ([r, g, b]: [number, number, number]): number => {
  const c = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const ratio = (a: [number, number, number], b: [number, number, number]): number => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
/** Color `fg` con opacidad `alpha` sobre `bg`. */
const blend = (fg: string, bg: string, alpha: number): [number, number, number] =>
  rgb(fg).map((v, i) => v * alpha + rgb(bg)[i]! * (1 - alpha)) as [number, number, number]

describe.each([
  ['claro', light],
  ['oscuro', dark],
])('contraste de tokens (%s) [AC-5]', (_name, t) => {
  const pairs: [string, string][] = [
    ['text', 'surface-0'],
    ['text', 'surface-card'],
    ['text', 'primary-soft'],
    ['text-muted', 'surface-0'],
    ['text-muted', 'surface-card'],
    ['text-muted', 'surface-50'],
    ['text-on-primary', 'primary'],
    ['text-inverse', 'surface-inverse'],
    ['danger-text', 'danger-bg'],
  ]
  it.each(pairs)('%s sobre %s ≥ 4,5:1', (fg, bg) => {
    expect(ratio(rgb(t[fg]!), rgb(t[bg]!))).toBeGreaterThanOrEqual(4.5)
  })

  it('texto deshabilitado (opacidad 0,7) sobre la superficie ≥ 4,5:1 [AC-3]', () => {
    expect(ratio(blend(t.text!, t['surface-0']!, 0.7), rgb(t['surface-0']!))).toBeGreaterThanOrEqual(4.5)
  })

  it('el borde fuerte sirve de indicador (≥ 3:1) [AC-4]', () => {
    expect(ratio(rgb(t['border-strong']!), rgb(t['surface-0']!))).toBeGreaterThanOrEqual(3)
  })
})

describe('el amarillo primary no es indicador sobre claro [AC-4]', () => {
  it('queda por debajo de 3:1 sobre la superficie clara: por eso es solo fondo', () => {
    expect(ratio(rgb(light.primary!), rgb(light['surface-0']!))).toBeLessThan(3)
  })
})
