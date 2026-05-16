import { router } from "./router";
import { webDomain, clerkPublishableKey, clerkSecretKey } from "./secrets";

const isNamedStage = $app.stage === "production" || $app.stage === "dev";

export const app = new sst.aws.Nextjs("Application", {
    path: "packages/application",
    router: isNamedStage
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
    },
});
