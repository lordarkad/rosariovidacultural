import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Los valores salen de las variables de src/assets/tokens.css (único archivo con hex): el preset no
// repite colores y el modo oscuro lo resuelve el CSS (`prefers-color-scheme`).
const sabalo = (step: number) => `var(--rq-sabalo-${step})`

export const RiberaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: sabalo(50), 100: sabalo(100), 200: sabalo(200), 300: sabalo(300), 400: sabalo(400),
      500: sabalo(500), 600: sabalo(600), 700: sabalo(700), 800: sabalo(800), 900: sabalo(900),
      950: sabalo(950),
    },
    // 0,6 de Aura deja el texto deshabilitado en ~4:1; con 0,7 pasa 4,5:1 en claro y oscuro (AC-3)
    disabledOpacity: '0.7',
    formField: { borderRadius: 'var(--rq-radius-input)' },
    colorScheme: {
      light: {
        primary: {
          color: 'var(--rq-primary)',
          contrastColor: 'var(--rq-text-on-primary)',
          hoverColor: 'var(--rq-primary-hover)',
          activeColor: 'var(--rq-primary-hover)',
        },
        surface: { 0: 'var(--rq-surface-0)', 50: 'var(--rq-surface-50)', 100: 'var(--rq-surface-100)' },
      },
      dark: {
        primary: {
          color: 'var(--rq-primary)',
          contrastColor: 'var(--rq-text-on-primary)',
          hoverColor: 'var(--rq-primary-hover)',
          activeColor: 'var(--rq-primary-hover)',
        },
        surface: { 0: 'var(--rq-surface-0)', 50: 'var(--rq-surface-50)', 100: 'var(--rq-surface-100)' },
      },
    },
  },
  // El amarillo `primary` es fondo, no color de texto ni de borde sobre claro (AC-2): los botones
  // `outlined` y `text` usan `text`/`border-strong`.
  components: {
    button: {
      colorScheme: {
        light: {
          outlined: {
            primary: {
              hoverBackground: 'var(--rq-primary-soft)',
              activeBackground: 'var(--rq-primary-soft)',
              borderColor: 'var(--rq-border-strong)',
              color: 'var(--rq-text)',
            },
          },
          text: {
            primary: {
              hoverBackground: 'var(--rq-primary-soft)',
              activeBackground: 'var(--rq-primary-soft)',
              color: 'var(--rq-text)',
            },
          },
        },
        dark: {
          outlined: {
            primary: {
              hoverBackground: 'var(--rq-primary-soft)',
              activeBackground: 'var(--rq-primary-soft)',
              borderColor: 'var(--rq-border-strong)',
              color: 'var(--rq-text)',
            },
          },
          text: {
            primary: {
              hoverBackground: 'var(--rq-primary-soft)',
              activeBackground: 'var(--rq-primary-soft)',
              color: 'var(--rq-text)',
            },
          },
        },
      },
    },
  },
})
