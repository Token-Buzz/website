import { router } from "./router";

const baseDomain = process.env.WEB_DOMAIN;
const appDomain = baseDomain ? `app.${baseDomain}` : undefined;

export const app = new sst.aws.Nextjs("Application", {
    path: "packages/application",
    router: appDomain
        ? {
            instance: router,
            domain: appDomain,
        }
        : undefined,
    environment: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? "",
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "",
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/dashboard",
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/dashboard",
    },
});
