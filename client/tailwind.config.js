/** Colors come from CSS variables so light/dark tokens swap in one place (see index.css). */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { bg: v('bg'), surface: v('surface'), raised: v('raised'), ink: v('ink'), muted: v('muted'), line: v('line'), brand: v('brand'), 'brand-ink': v('brand-ink'), accent: v('accent'), danger: v('danger'), ok: v('ok') },
      fontFamily: { display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'], sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(var(--shadow) / .06), 0 8px 24px -12px rgb(var(--shadow) / .18)', pop: '0 12px 40px -8px rgb(var(--shadow) / .3)' },
      borderRadius: { xl2: '1.25rem' }
    }
  },
  plugins: []
};
