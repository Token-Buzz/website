import { router } from "./router";
import { webDomain, clerkPublishableKey, clerkSecretKey, opencageApiKey } from "./secrets";
import { tweetsTable, aggregatesTable, tokensTable, userDataTable, authorLocationsTable } from "./db";

const isProd = $app.stage === "production";
const isPR = $app.stage.startsWith("pr-");

// ── Next.js application ────────────────────────────────────────────────────

export const app = new sst.aws.Nextjs("Application", {
    path: "packages/application",
    domain: isPR
        ? {
              name: $interpolate`app.${$app.stage}.${webDomain.value}`,
              dns: sst.cloudflare.dns({ proxy: false }),
          }
        : undefined,
    router: isProd
        ? {
              instance: router,
              domain: $interpolate`app.${webDomain.value}`,
          }
        : undefined,
    environment: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey.value,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/dashboard",
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/dashboard",
        OPENCAGE_API_KEY: opencageApiKey.value,
    },
    link: [tweetsTable, aggregatesTable, tokensTable, userDataTable, authorLocationsTable],
});
