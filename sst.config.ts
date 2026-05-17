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
  console: {
    autodeploy: {
      target(event) {
        if (event.type === "branch" && event.branch === "master" && event.action === "pushed") {
          return { stage: "production" };
        }
        if (event.type === "pull_request") {
          if (event.action === "pushed") {
            return { stage: `pr-${event.number}` };
          }
          if (event.action === "removed") {
            return { stage: `pr-${event.number}`, mode: "remove" };
          }
        }
        return undefined;
      },
      async workflow({ $, event }) {
        await $`n 22`;
        if (event.action === "removed") {
          await $`npx sst unlock`.nothrow();
          await $`npx sst remove`;
        } else {
          await $`npm ci`;
          await $`npm run lint`;
          await $`npm run typecheck`;
          await $`npx sst unlock`.nothrow();
          await $`npx sst deploy`;
        }
      },
    },
  },
  async run() {
    await import("./infra/secrets");
    await import("./infra/router");
    await import("./infra/marketing");
    await import("./infra/application");
    await import("./infra/clerk");
  },
});
