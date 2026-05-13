import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
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
      },
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
        serif:   ['var(--font-serif)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
