/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #0d1117)',
          text: 'var(--tg-theme-text-color, #e6edf3)',
          hint: 'var(--tg-theme-hint-color, #8b949e)',
          link: 'var(--tg-theme-link-color, #58a6ff)',
          button: 'var(--tg-theme-button-color, #238636)',
          buttonText: 'var(--tg-theme-button-text-color, #ffffff)',
          secondaryBg: 'var(--tg-theme-secondary-bg-color, #161b22)',
          headerBg: 'var(--tg-theme-header-bg-color, #0d1117)',
          accent: 'var(--tg-theme-accent-text-color, #388bfd)',
          sectionBg: 'var(--tg-theme-section-bg-color, #161b22)',
        },
        status: {
          operational: '#10b981', // emerald-500
          degraded: '#f59e0b',    // amber-500
          partial: '#f97316',     // orange-500
          outage: '#ef4444',      // rose-500
          maintenance: '#3b82f6', // blue-500
        },
      },
      boxShadow: {
        glow: '0 0 25px -5px rgba(16, 185, 129, 0.25)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.25)',
        'glow-rose': '0 0 25px -5px rgba(239, 68, 68, 0.25)',
      },
    },
  },
  plugins: [],
};
