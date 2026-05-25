// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "website",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
        cloudflare: {
          version: "6.15.0",
          apiToken: process.env.CLOUDFLARE_API_TOKEN,
        },
      },
    };
  },
  async run() {
    await import("./infra/secrets");
    const { router } = await import("./infra/router");
    const { web: marketing } = await import("./infra/marketing");
    const { byokKmsKey } = await import("./infra/byok");
    const { app: application } = await import("./infra/application");
    await import("./infra/clerk");
    await import("./infra/jobs");

    return {
      router: router.url,
      marketing: marketing.url,
      application: application.url,
    };
  },
});
