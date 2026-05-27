import { router } from "./router";
import { tweetsTable, aggregatesTable, tokensTable, userDataTable } from "./db";

const isProd = $app.stage === "production";

// Marketing live-ticker snapshot: a public, CloudFront-fronted ticker.json
// regenerated on a schedule and served same-origin at /static/ticker.json.
// Production-only — matches the other external-data crons (e.g. PriceWarmup);
// PR/dev stages fall back to the marketing page's hardcoded ticker data.
if (isProd) {
  const tickerBucket = new sst.aws.Bucket("TickerBucket", { access: "cloudfront" });

  // Serve the snapshot at the apex: tokenbuzz.app/static/ticker.json
  router.routeBucket("/static/*", tickerBucket);

  // EventBridge's floor is 1 minute (sub-minute schedules aren't supported); the
  // 30s client poll + 30s cache headers keep the banner fresh between writes.
  new sst.aws.Cron("TickerSnapshot", {
    schedule: "rate(1 minute)",
    function: {
      handler: "packages/jobs/src/ticker-snapshot.handler",
      link: [tweetsTable, aggregatesTable, tokensTable, userDataTable],
      environment: { TICKER_BUCKET: tickerBucket.name },
      permissions: [
        { actions: ["s3:PutObject"], resources: [$interpolate`${tickerBucket.arn}/*`] },
      ],
      timeout: "60 seconds",
      memory: "256 MB",
    },
  });
}
