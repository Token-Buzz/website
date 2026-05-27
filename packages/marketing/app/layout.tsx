import type { Metadata, Viewport } from 'next'
import {
  Bungee_Inline,
  Space_Grotesk,
  JetBrains_Mono,
  Fraunces,
} from 'next/font/google'
import './globals.css'

const bungeeInline = Bungee_Inline({
  weight: '400',
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

const fraunces = Fraunces({
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
})

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export const metadata: Metadata = {
  title: 'TokenBuzz · Hear the market before you see it',
  description:
    'TokenBuzz tracks real-time buzz, sentiment, and mentions across X for any token or keyword. The chart catches up later.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${bungeeInline.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body style={{ fontFamily: 'var(--font-sans)' }}>{children}</body>
    </html>
  )
}
