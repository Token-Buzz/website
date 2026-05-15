import type { Metadata } from 'next'
import {
  Bungee_Inline,
  Space_Grotesk,
  JetBrains_Mono,
  Fraunces,
} from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { clerkAppearance } from './clerk-theme'
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

export const metadata: Metadata = {
  title: 'TokenBuzz',
  description: 'Track real-time buzz, sentiment, and mentions across X for any token or keyword.',
}

const publishableKey =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_PROD_CLERK_PUBLISHABLE_KEY
    : process.env.NEXT_PUBLIC_DEV_CLERK_PUBLISHABLE_KEY

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      publishableKey={publishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        data-theme="dark"
        className={`${bungeeInline.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
      >
        <body style={{ fontFamily: 'var(--font-sans)' }}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
