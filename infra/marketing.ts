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

export const web = new sst.aws.Nextjs("Marketing", {
    path: "packages/marketing",
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
