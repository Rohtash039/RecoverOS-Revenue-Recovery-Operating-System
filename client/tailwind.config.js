/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ops: {
          bg: 'var(--ops-bg)',
          surface: 'var(--ops-surface)',
          'surface-subtle': 'var(--ops-surface-subtle)',
          'surface-hover': 'var(--ops-surface-hover)',
          border: 'var(--ops-border)',
          'border-subtle': 'var(--ops-border-subtle)',
          text: {
            primary: 'var(--ops-text-primary)',
            secondary: 'var(--ops-text-secondary)',
            muted: 'var(--ops-text-muted)'
          }
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Geist', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
