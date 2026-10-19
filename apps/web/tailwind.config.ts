import type { Config } from 'tailwindcss'

// Los colores leen las variables semánticas de src/assets/tokens.css; no hay hex acá.
const rq = (name: string) => `var(--rq-${name})`

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: rq('surface-0'),
          50: rq('surface-50'),
          100: rq('surface-100'),
          card: rq('surface-card'),
          inverse: rq('surface-inverse'),
        },
        ink: {
          DEFAULT: rq('text'),
          muted: rq('text-muted'),
          inverse: rq('text-inverse'),
          'on-primary': rq('text-on-primary'),
        },
        line: { DEFAULT: rq('border'), strong: rq('border-strong') },
        primary: { DEFAULT: rq('primary'), hover: rq('primary-hover'), soft: rq('primary-soft') },
        focus: rq('focus'),
        evento: rq('type-evento'),
        lugar: rq('type-lugar'),
      },
      fontFamily: {
        display: ['var(--rq-font-display)'],
        body: ['var(--rq-font-body)'],
      },
      borderRadius: {
        chip: rq('radius-chip'),
        card: rq('radius-card'),
        sheet: rq('radius-sheet'),
        button: rq('radius-button'),
        tag: rq('radius-tag'),
        input: rq('radius-input'),
      },
    },
  },
} satisfies Config
