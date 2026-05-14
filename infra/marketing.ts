const isProd = $app.stage === "production";
const domain = process.env.WEB_DOMAIN;

if (isProd && !domain) {
    throw new Error(
        "WEB_DOMAIN environment variable is required for the production stage.",
    );
}

export const web = new sst.aws.Nextjs("Marketing", {
    path: "packages/marketing",
    domain: domain
        ? {
            name: domain,
            dns: sst.cloudflare.dns({
                proxy: true,
            }),
            redirects: isProd ? [`www.${domain}`] : undefined,
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
