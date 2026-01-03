import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
        accent: {
          50: 'var(--accent-50)',
          500: 'var(--accent-500)',
          700: 'var(--accent-700)',
        },
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          700: 'var(--success-700)',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          700: 'var(--warning-700)',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          600: '#dc2626',
          700: 'var(--danger-700)',
        },
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
      borderRadius: {
        xl: 'var(--radius-md)',
        '2xl': 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
};

export default config;
