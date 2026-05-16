import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  env: {
    // Map the project's stage-specific key names to what Clerk's SDK expects
    CLERK_SECRET_KEY: isProd
      ? (process.env.PROD_CLERK_SECRET_KEY ?? '')
      : (process.env.DEV_CLERK_SECRET_KEY ?? ''),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: isProd
      ? (process.env.NEXT_PUBLIC_PROD_CLERK_PUBLISHABLE_KEY ?? '')
      : (process.env.NEXT_PUBLIC_DEV_CLERK_PUBLISHABLE_KEY ?? ''),
  },
}

export default nextConfig
