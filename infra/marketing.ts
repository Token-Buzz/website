import { router } from "./router";

const domain = process.env.WEB_DOMAIN;

export const web = new sst.aws.Nextjs("Marketing", {
    path: "packages/marketing",
    router: domain
        ? {
            instance: router,
            domain,
        }
        : undefined,
    environment: {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
        NEXT_PUBLIC_MARKETING_DOMAIN: process.env.MARKETING_DOMAIN ?? "",
        TURNSTILE_SECRET: process.env.TURNSTILE_SECRET ?? "",
        RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
        CONTACT_TO_ADDRESS: process.env.CONTACT_TO_ADDRESS ?? "",
        CONTACT_FROM_ADDRESS: process.env.CONTACT_FROM_ADDRESS ?? "",
    },
});
