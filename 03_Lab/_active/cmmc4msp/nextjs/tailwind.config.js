/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          light:   'var(--color-brand-light)',
          muted:   'var(--color-brand-muted)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-bg)',
          border:  'var(--sidebar-border)',
          text:    'var(--sidebar-text)',
        },
      },
      width: {
        sidebar:             'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-collapsed-width)',
      },
    },
  },
  plugins: [],
}
