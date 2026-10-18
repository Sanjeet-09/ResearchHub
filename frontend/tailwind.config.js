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
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        txt: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        input: '8px',
        card: '12px',
        modal: '16px',
      },
      boxShadow: {
        accent: '0 0 24px rgba(124, 131, 255, 0.25)',
        'accent-glow': '0 0 30px rgba(124, 131, 255, 0.35)',
      },
      spacing: {
        '58': '232px',
        sidebar: '232px',
      },
      width: {
        '58': '232px',
        sidebar: '232px',
      },
      padding: {
        '58': '232px',
        sidebar: '232px',
      },
    },
  },
  plugins: [],
};
