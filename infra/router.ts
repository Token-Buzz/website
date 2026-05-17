import { webDomain } from "./secrets";

const isProd = $app.stage === "production";
const isNamedStage = isProd || $app.stage === "dev";

export const router = new sst.aws.Router("Router", {
    domain: isNamedStage
        ? {
              name: isProd
                  ? webDomain.value
                  : webDomain.value.apply(d => `app-dev.${d}`),
              aliases: isProd
                  ? webDomain.value.apply(d => [`app.${d}`])
                  : [],
              dns: sst.cloudflare.dns({
                  proxy: true,
              }),
              redirects: isProd
                  ? webDomain.value.apply(d => [`www.${d}`])
                  : undefined,
          }
        : undefined,
});
