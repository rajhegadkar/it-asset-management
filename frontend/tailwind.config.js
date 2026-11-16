/** @type {import('tailwindcss').Config} */
// Design system v3 ("Aurora"): the brand scale is driven by CSS variables that are generated
// from the Primary Brand Colour in the Customization Center (see customization/brandTheme.ts).
// Every existing `blue-*` utility in the app therefore follows the organisation's brand colour.
const brand = (shade) => `rgb(var(--brand-${shade}) / <alpha-value>)`;
const brandScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => [s, brand(s)])
);

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        blue: brandScale,
        brand: brandScale,
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          canvas: 'rgb(var(--canvas) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(16 24 40 / 0.08), 0 2px 6px -2px rgb(16 24 40 / 0.05)',
        pop: '0 20px 48px -12px rgb(16 24 40 / 0.25)',
        glow: '0 0 0 4px rgb(var(--brand-500) / 0.15)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'sheet-up': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        'pop-in': { '0%': { opacity: '0', transform: 'scale(.97) translateY(4px)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-in-right': { '0%': { opacity: '0', transform: 'translateX(16px)' }, '100%': { opacity: '1', transform: 'none' } },
        'drawer-in': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up .28s cubic-bezier(.2,.8,.2,1) both',
        'fade-in': 'fade-in .2s ease-out both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in .2s cubic-bezier(.2,.8,.2,1) both',
        'slide-in-right': 'slide-in-right .25s cubic-bezier(.2,.8,.2,1) both',
        'drawer-in': 'drawer-in .25s cubic-bezier(.2,.8,.2,1) both',
      },
      screens: {
        xs: '420px',
      },
    },
  },
  plugins: [],
};
