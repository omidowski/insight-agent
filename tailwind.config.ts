import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        glow: 'rgb(var(--glow) / <alpha-value>)',
      },
      boxShadow: {
        'glow-sm': '0 0 14px -2px rgb(var(--accent) / 0.35)',
        'glow': '0 0 24px -3px rgb(var(--accent) / 0.45)',
        'glow-lg': '0 0 42px -6px rgb(var(--accent) / 0.6)',
        'glow-xl': '0 0 64px -8px rgb(var(--accent) / 0.7)',
        'card-soft': '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
        'card-deep': '0 16px 40px -8px rgba(0, 0, 0, 0.2), 0 6px 16px -3px rgba(0, 0, 0, 0.1)',
        'card-glow': '0 12px 36px -6px rgba(0, 0, 0, 0.18), 0 0 24px -2px rgb(var(--accent) / 0.28)',
        'card-glow-hover': '0 20px 48px -8px rgba(0, 0, 0, 0.25), 0 0 36px -2px rgb(var(--accent) / 0.45)',
        'elevated': '0 12px 34px -6px rgba(0, 0, 0, 0.16), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
        'float': '0 24px 54px -12px rgba(0, 0, 0, 0.26), 0 0 32px -4px rgb(var(--accent) / 0.25)',
      },
      animation: {
        'gradient-slide': 'gradient-slide 4s ease infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer-sweep': 'shimmer-sweep 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        'border-flow': 'border-flow 5s linear infinite',
      },
      keyframes: {
        'gradient-slide': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.05)' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'border-flow': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '100' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
