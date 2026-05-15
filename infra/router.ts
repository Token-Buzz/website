const isProd = $app.stage === "production";
const domain = process.env.WEB_DOMAIN;

if (isProd && !domain) {
    throw new Error(
        "WEB_DOMAIN environment variable is required for the production stage.",
    );
}

export const router = new sst.aws.Router("Router", {
    domain: domain
        ? {
            name: domain,
            aliases: [`*.${domain}`],
            dns: sst.cloudflare.dns({
                proxy: true,
            }),
            redirects: isProd ? [`www.${domain}`] : undefined,
        }
        : undefined,
});
