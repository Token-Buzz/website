import { webDomain } from "./secrets";

const isProd = $app.stage === "production";
const isNamedStage = isProd || $app.stage === "dev";

export const router = new sst.aws.Router("Router", {
    domain: isNamedStage
        ? {
              name: webDomain.value,
              aliases: webDomain.value.apply(d => [`*.${d}`]),
              dns: sst.cloudflare.dns({
                  proxy: true,
              }),
              redirects: isProd ? webDomain.value.apply(d => [`www.${d}`]) : undefined,
          }
        : undefined,
});
