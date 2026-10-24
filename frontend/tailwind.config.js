/** @type {import('tailwindcss').Config} */
import animate from 'tailwindcss-animate';

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
          DEFAULT: 'var(--surface-1)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        panel: {
          DEFAULT: 'var(--surface-1)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        text: {
          DEFAULT: 'var(--text)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
        },
        txt: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-2)',
          faint: 'var(--text-3)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-fg)',
          fg: 'var(--primary-fg)',
        },
        secondary: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--text)',
        },
        success: {
          DEFAULT: 'var(--success)',
          bg: 'var(--success-bg)',
          soft: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          bg: 'var(--warning-bg)',
          soft: 'var(--warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          bg: 'var(--danger-bg)',
          soft: 'var(--danger-bg)',
        },
        destructive: {
          DEFAULT: 'var(--danger)',
          foreground: '#FFFFFF',
        },
        info: {
          DEFAULT: 'var(--info)',
          bg: 'var(--info-bg)',
          soft: 'var(--info-bg)',
        },
        focus: 'var(--primary)',
        ring: 'var(--primary)',
        input: 'var(--surface-2)',
        foreground: 'var(--text)',
        background: 'var(--bg)',
        card: {
          DEFAULT: 'var(--surface-1)',
          foreground: 'var(--text)',
        },
        popover: {
          DEFAULT: 'var(--surface-1)',
          foreground: 'var(--text)',
        },
        muted: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--text-2)',
        },
        accent: {
          DEFAULT: 'var(--surface-2)',
          foreground: 'var(--text)',
          hover: 'var(--surface-3)',
          soft: 'var(--surface-2)',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        dialog: '12px',
        pill: '999px',
        full: '9999px',
        sm: '8px',
        md: '8px',
        lg: '12px',
        xl: '12px',
      },
      boxShadow: {
        floating: '0 12px 32px #000000',
        'card-inset': 'inset 0 1px 0 #1A1A1A',
        card: 'inset 0 1px 0 #1A1A1A',
      },
      zIndex: {
        content: '0',
        table: '10',
        strip: '40',
        island: '50',
        dropdown: '60',
        dialog: '70',
        toast: '80',
      },
    },
  },
  plugins: [animate],
};
