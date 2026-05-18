import { router } from "./router";
import {
    webDomain,
    turnstileSiteKey,
    turnstileSecret,
    resendApiKey,
    contactToAddress,
    contactFromAddress,
} from "./secrets";

const isProd = $app.stage === "production";
const isPR = $app.stage.startsWith("pr-");

export const web = new sst.aws.Nextjs("Marketing", {
    path: "packages/marketing",
    domain: isPR
        ? {
              name: $interpolate`${$app.stage}.${webDomain.value}`,
              dns: sst.cloudflare.dns({ proxy: false }),
          }
        : undefined,
    router: isProd
        ? {
              instance: router,
              domain: webDomain.value,
          }
        : undefined,
    environment: {
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey.value,
        NEXT_PUBLIC_MARKETING_DOMAIN: webDomain.value,
        TURNSTILE_SECRET: turnstileSecret.value,
        RESEND_API_KEY: resendApiKey.value,
        CONTACT_TO_ADDRESS: contactToAddress.value,
        CONTACT_FROM_ADDRESS: contactFromAddress.value,
    },
});
