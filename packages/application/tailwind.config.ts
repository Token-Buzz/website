import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Raw palette
        peach: {
          '50':  '#FDF5EC',
          '100': '#FBEEDD',
          '200': '#F7D8BE',
          '300': '#F1BE9C',
          '400': '#E59C6E',
        },
        ink: {
          '100':  '#EFEAE1',
          '200':  '#E1DDD6',
          '300':  '#C9C9CF',
          '400':  '#A3A3AB',
          '500':  '#7A7A82',
          '600':  '#55555E',
          '700':  '#34343A',
          '800':  '#232325',
          '900':  '#161617',
          '1000': '#0B0B0C',
        },
        buzz: {
          '50':  '#FFF1E6',
          '100': '#FFD9BA',
          '300': '#FFA876',
          '500': '#FF6B2C',
          '600': '#E5531A',
          '700': '#B83E10',
        },
        bull: {
          '100': '#DCEACF',
          '500': '#4F8A4A',
        },
        bear: {
          '100': '#F5D4C8',
          '500': '#C8462E',
        },
        neutral: {
          '100': '#F2E1BF',
          '500': '#C68A2E',
        },
        // Semantic tokens (CSS var–backed, theme-aware)
        bg: {
          DEFAULT:     'var(--bg)',
          elevated:    'var(--bg-elevated)',
          sunken:      'var(--bg-sunken)',
          inverse:     'var(--bg-inverse)',
          translucent: 'var(--bg-translucent)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          hover:   'var(--surface-hover)',
          active:  'var(--surface-active)',
        },
        fg: {
          DEFAULT: 'var(--fg-1)',
          '1': 'var(--fg-1)',
          '2': 'var(--fg-2)',
          '3': 'var(--fg-3)',
          '4': 'var(--fg-4)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          press:   'var(--accent-press)',
          soft:    'var(--accent-soft)',
        },
        border: {
          DEFAULT:  'var(--border)',
          strong:   'var(--border-strong)',
          hairline: 'var(--border-hairline)',
        },
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        neu: 'var(--neu)',
        inv: {
          bg:     'var(--inv-bg)',
          fg:     'var(--inv-fg)',
          border: 'var(--inv-border)',
        },
        data: {
          bg:      'var(--data-bg)',
          surface: 'var(--data-surface)',
          fg:      'var(--data-fg)',
          dim:     'var(--data-dim)',
          line:    'var(--data-line)',
          amber:   'var(--data-amber)',
          pos:     'var(--data-pos)',
          neg:     'var(--data-neg)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
        serif:   ['var(--font-serif)', 'Georgia', 'serif'],
      },
      spacing: {
        'sp-1':  '4px',
        'sp-2':  '8px',
        'sp-3':  '12px',
        'sp-4':  '16px',
        'sp-5':  '20px',
        'sp-6':  '24px',
        'sp-7':  '32px',
        'sp-8':  '40px',
        'sp-9':  '56px',
        'sp-10': '72px',
        'sp-11': '96px',
      },
      borderRadius: {
        r1:   '4px',
        r2:   '6px',
        r3:   '10px',
        r4:   '14px',
        r5:   '20px',
        pill: '999px',
      },
      fontSize: {
        'd1':    ['72px', { lineHeight: '1.05' }],
        'd2':    ['56px', { lineHeight: '1.05' }],
        'd3':    ['40px', { lineHeight: '1.2'  }],
        'h1':    ['32px', { lineHeight: '1.2'  }],
        'h2':    ['24px', { lineHeight: '1.2'  }],
        'h3':    ['20px', { lineHeight: '1.2'  }],
        'h4':    ['17px', { lineHeight: '1.35' }],
        'body':  ['15px', { lineHeight: '1.5'  }],
        'small': ['13px', { lineHeight: '1.45' }],
        'micro': ['11px', { lineHeight: '1.3'  }],
      },
      letterSpacing: {
        display: '0.01em',
        eyebrow: '0.18em',
        mono:    '-0.01em',
        body:    '-0.005em',
      },
      boxShadow: {
        'shadow-1': '0 1px 0 rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'shadow-2': '0 2px 8px rgba(0,0,0,0.4), 0 12px 24px -8px rgba(0,0,0,0.5)',
        'shadow-3': '0 16px 40px -10px rgba(0,0,0,0.6)',
        'glow-buzz': '0 0 0 1px var(--buzz-500), 0 0 18px -2px rgba(255,107,44,0.35)',
      },
    },
  },
  plugins: [],
}

export default config
