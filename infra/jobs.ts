import { tweetsTable, aggregatesTable, tokensTable, userDataTable } from "./db";
import { twitterApiKey } from "./secrets"


const allTables = [tweetsTable, aggregatesTable, tokensTable, userDataTable];

const BEDROCK_HAIKU_ARN = [
  "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
  "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
];

const isProd = $app.stage === "production";
// Interim kill-switch — automatic twitterapi.io polling is off until ENABLE_POLLING=true in
// production; superseded by M10 BYOK Phase 6 (#112).
const POLLING_ENABLED = process.env.ENABLE_POLLING === "true";

if (isProd && POLLING_ENABLED) {
  // 1. Tweet ingestion poller — every 2 minutes
  new sst.aws.Cron("TweetPoller", {
    schedule: "rate(2 minutes)",
    function: {
      handler: "packages/jobs/src/poller.handler",
      environment: { TWITTER_API_KEY: twitterApiKey.value },
      link: allTables,
      timeout: "90 seconds",
      memory: "256 MB",
    },
  });

  // 4. Follower snapshot — daily at 02:00 UTC
  new sst.aws.Cron("FollowerSnapshot", {
    schedule: "cron(0 2 * * ? *)",
    function: {
      handler: "packages/jobs/src/follower-snapshot.handler",
      environment: { TWITTER_API_KEY: twitterApiKey.value },
      link: allTables,
      timeout: "300 seconds",
      memory: "256 MB",
    },
  });

  // 5. Engagement refresh — hourly
  new sst.aws.Cron("EngagementSnapshot", {
    schedule: "rate(1 hour)",
    function: {
      handler: "packages/jobs/src/engagement-snapshot.handler",
      environment: { TWITTER_API_KEY: twitterApiKey.value },
      link: allTables,
      timeout: "300 seconds",
      memory: "256 MB",
    },
  });
}

// 2. DDB Streams aggregator — INSERT fan-out to Aggregates table.
// All four tables are linked because the shared db client (packages/core/src/db/client.ts)
// eagerly reads Resource.<Table>.name at module load; missing any link crashes init.
tweetsTable.subscribe(
  "Aggregator",
  {
    handler: "packages/jobs/src/aggregator.handler",
    link: allTables,
    timeout: "60 seconds",
  },
  { filters: [{ eventName: ["INSERT"] }] },
);

// 3. Sentiment dispatcher — separate stream consumer; Bedrock IAM scoped only here.
// All four tables are linked because core/db/client.ts eagerly reads Resource.<Table>.name
// for all four tables at module load; missing any one crashes init with "X is not linked".
tweetsTable.subscribe(
  "SentimentDispatcher",
  {
    handler: "packages/jobs/src/sentiment.handler",
    link: allTables,
    timeout: "120 seconds",
    memory: "512 MB",
    permissions: [
      {
        actions: ["bedrock:InvokeModel"],
        resources: BEDROCK_HAIKU_ARN,
      },
    ],
  },
  { filters: [{ eventName: ["INSERT"] }] },
);

// 6. Spike materializer — every 5 minutes
new sst.aws.Cron("SpikeMaterializer", {
  schedule: "rate(5 minutes)",
  function: {
    handler: "packages/jobs/src/spike-materializer.handler",
    link: allTables,
    timeout: "60 seconds",
    memory: "256 MB",
  },
});

// 7. Daily rollup — 00:15 UTC
new sst.aws.Cron("DailyRollup", {
  schedule: "cron(15 0 * * ? *)",
  function: {
    handler: "packages/jobs/src/daily-rollup.handler",
    link: allTables,
    timeout: "300 seconds",
    memory: "256 MB",
  },
});
