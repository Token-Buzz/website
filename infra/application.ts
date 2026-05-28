import { router } from "./router";
import { webDomain, clerkPublishableKey, clerkSecretKey, opencageApiKey, stripeSecretKey, stripeWebhookSecret, stripePublishableKey, stripePriceProMonth, stripePriceProYear, stripePriceAlphaMonth, stripePriceAlphaYear, resendApiKey, contactFromAddress } from "./secrets";
import { tweetsTable, aggregatesTable, tokensTable, userDataTable, authorLocationsTable } from "./db";
import { byokKmsKey } from "./byok";

const BEDROCK_HUM_ARN = [
  "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-6*",
  "arn:aws:bedrock:*:*:inference-profile/*anthropic.claude-sonnet-4-6*",
];

const isProd = $app.stage === "production";
const isPR = $app.stage.startsWith("pr-");

// ── Next.js application ────────────────────────────────────────────────────

export const app = new sst.aws.Nextjs("Application", {
    path: "packages/application",
    server: {
        // POST /api/query fetches up to 5 pages from twitterapi.io plus geo
        // lookups, which can exceed the 20s default.
        timeout: "60 seconds",
    },
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
        WEB_DOMAIN: webDomain.value,
        RESEND_API_KEY: resendApiKey.value,
        CONTACT_FROM_ADDRESS: contactFromAddress.value,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/dashboard",
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/dashboard",
        OPENCAGE_API_KEY: opencageApiKey.value,
        BYOK_KMS_KEY_ID: byokKmsKey.id,
        STRIPE_SECRET_KEY: stripeSecretKey.value,
        STRIPE_WEBHOOK_SECRET: stripeWebhookSecret.value,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePublishableKey.value,
        STRIPE_PRICE_PRO_MONTH: stripePriceProMonth.value,
        STRIPE_PRICE_PRO_YEAR: stripePriceProYear.value,
        STRIPE_PRICE_ALPHA_MONTH: stripePriceAlphaMonth.value,
        STRIPE_PRICE_ALPHA_YEAR: stripePriceAlphaYear.value,
    },
    permissions: [
        {
            actions: ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"],
            resources: [byokKmsKey.arn],
        },
        {
            actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
            resources: BEDROCK_HUM_ARN,
        },
    ],
    link: [tweetsTable, aggregatesTable, tokensTable, userDataTable, authorLocationsTable],
});
