import type { Config } from 'tailwindcss'

/**
 * Tailwind theme mapped to the allNeurons design system (docs/design.md).
 * Raw hex values live here only because this is the token-definition layer;
 * component code must reference these semantic names, never raw hex.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#115ACB', // Blue 500
          hover: '#0044AE', // Blue 600
          50: '#E7EFFC',
          500: '#115ACB',
          600: '#0044AE',
          700: '#0D469E',
        },
        ink: '#070A0E', // Grey 900 — primary text
        muted: '#4A4C4F', // Grey 500 — secondary text
        surface: '#FAFAFA', // Grey 25 — page background
        subtle: '#F0F0F1', // Grey 50 — dividers / hover
        line: '#DADADB', // Grey 100 — borders
        grey: {
          25: '#FAFAFA',
          50: '#F0F0F1',
          100: '#DADADB',
          200: '#C1C2C3',
          300: '#8F9193',
          400: '#5E6062',
          500: '#4A4C4F',
          900: '#070A0E',
        },
        success: { 50: '#E7F6E7', 200: '#92D490', 500: '#13A10E', 700: '#0D720A' },
        warning: { 50: '#FFF9F0', 200: '#FFE3BD', 500: '#FFAA33', 700: '#DB8000', 800: '#B36800' },
        danger: { 50: '#FAEBEB', 200: '#EAA2A3', 500: '#D13438', 700: '#942528' },
        accent: { 50: '#F7F0FF', 200: '#E3C7FF', 500: '#7F00FF', 700: '#6600CC' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter Display', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['48px', { lineHeight: '56px', fontWeight: '700' }],
        h2: ['36px', { lineHeight: '44px', fontWeight: '700' }],
        h3: ['30px', { lineHeight: '38px', fontWeight: '600' }],
        h5: ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-sm': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
      borderRadius: {
        tag: '4px',
        button: '6px',
        input: '6px',
        card: '8px',
        modal: '12px',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}

export default config
