import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import { TriptongoUiSeedOverrides } from '@triptongo/ui/theme'

// Placeholder de marca (violeta Triptongo). Reemplazar por la identidad propia al definir docs/DESIGN.md.
// Cero hex fuera de este archivo.
const brandOverrides = {
  primitive: {
    violet: {
      50:  '#f5e6f5', 100: '#e9cceb', 200: '#d399d6', 300: '#bc66c2',
      400: '#a633ad', 500: '#8f0099', 600: '#800088', 700: '#741077',
      800: '#5c0d5f', 900: '#440a47', 950: '#2c0730',
    },
  },
  semantic: {
    primary: {
      50: '{violet.50}', 100: '{violet.100}', 200: '{violet.200}',
      300: '{violet.300}', 400: '{violet.400}', 500: '{violet.500}',
      600: '{violet.600}', 700: '{violet.700}', 800: '{violet.800}',
      900: '{violet.900}', 950: '{violet.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{violet.700}', hoverColor: '{violet.800}',
          activeColor: '{violet.900}', inverseColor: '{slate.50}',
        },
      },
      dark: {
        primary: {
          color: '{violet.300}', hoverColor: '{violet.200}',
          activeColor: '{violet.100}', inverseColor: '{slate.950}',
        },
      },
    },
  },
}

export const TriptongoPreset = definePreset(Aura, TriptongoUiSeedOverrides, brandOverrides)
