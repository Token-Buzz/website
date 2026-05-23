export const webDomain = new sst.Secret("WEB_DOMAIN");
export const clerkPublishableKey = new sst.Secret("CLERK_PUBLISHABLE_KEY");
export const clerkSecretKey = new sst.Secret("CLERK_SECRET_KEY");
export const turnstileSiteKey = new sst.Secret("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
export const turnstileSecret = new sst.Secret("TURNSTILE_SECRET");
export const resendApiKey = new sst.Secret("RESEND_API_KEY");
export const contactToAddress = new sst.Secret("CONTACT_TO_ADDRESS");
export const contactFromAddress = new sst.Secret("CONTACT_FROM_ADDRESS");
export const twitterApiKey = new sst.Secret("TWITTER_API_KEY");
export const opencageApiKey = new sst.Secret("OPENCAGE_API_KEY");
// Empty fallback so deploys (esp. ephemeral pr-<N> stages) don't fail when the
// PAT isn't seeded; /changelog renders its empty state until a real value is set.
export const githubToken = new sst.Secret("GITHUB_TOKEN", "");
