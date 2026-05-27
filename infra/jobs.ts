import { tweetsTable, aggregatesTable, tokensTable, userDataTable } from "./db";
import { clerkSecretKey, resendApiKey, contactFromAddress, webDomain } from "./secrets";
import { byokKmsKey } from "./byok";


const allTables = [tweetsTable, aggregatesTable, tokensTable, userDataTable];

const BEDROCK_HAIKU_ARN = [
  "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
  "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
];

const isProd = $app.stage === "production";
// The three polling crons no-op unless at least one key-holder has opted in
// (backgroundPolling=true in their BYOK record), so polling is gated per-user
// (default off) rather than by an env flag.

if (isProd) {
  // 1. Tweet ingestion poller — every 2 minutes
  new sst.aws.Cron("TweetPoller", {
    schedule: "rate(2 minutes)",
    function: {
      handler: "packages/jobs/src/poller.handler",
      environment: {
        BYOK_KMS_KEY_ID: byokKmsKey.id,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        RESEND_API_KEY: resendApiKey.value,
        CONTACT_FROM_ADDRESS: contactFromAddress.value,
        WEB_DOMAIN: webDomain.value,
      },
      link: allTables,
      timeout: "90 seconds",
      memory: "256 MB",
      permissions: [{ actions: ["kms:Decrypt"], resources: [byokKmsKey.arn] }],
    },
  });

  // 4. Follower snapshot — daily at 02:00 UTC
  new sst.aws.Cron("FollowerSnapshot", {
    schedule: "cron(0 2 * * ? *)",
    function: {
      handler: "packages/jobs/src/follower-snapshot.handler",
      environment: {
        BYOK_KMS_KEY_ID: byokKmsKey.id,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        RESEND_API_KEY: resendApiKey.value,
        CONTACT_FROM_ADDRESS: contactFromAddress.value,
        WEB_DOMAIN: webDomain.value,
      },
      link: allTables,
      timeout: "300 seconds",
      memory: "256 MB",
      permissions: [{ actions: ["kms:Decrypt"], resources: [byokKmsKey.arn] }],
    },
  });

  // 5. Engagement refresh — hourly
  new sst.aws.Cron("EngagementSnapshot", {
    schedule: "rate(1 hour)",
    function: {
      handler: "packages/jobs/src/engagement-snapshot.handler",
      environment: {
        BYOK_KMS_KEY_ID: byokKmsKey.id,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        RESEND_API_KEY: resendApiKey.value,
        CONTACT_FROM_ADDRESS: contactFromAddress.value,
        WEB_DOMAIN: webDomain.value,
      },
      link: allTables,
      timeout: "300 seconds",
      memory: "256 MB",
      permissions: [{ actions: ["kms:Decrypt"], resources: [byokKmsKey.arn] }],
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

// 9. Social events materializer — every 5 minutes
// Detects volume spikes and sentiment spikes from the trailing 3-hour PULSE
// series, and writes SOCIAL_SPIKE / SENTIMENT_SPIKE social events for the UI.
new sst.aws.Cron("SocialEventsMaterializer", {
  schedule: "rate(5 minutes)",
  function: {
    handler: "packages/jobs/src/social-events-materializer.handler",
    link: allTables,
    timeout: "120 seconds",
    memory: "256 MB",
  },
});

// 8. Alert evaluator — fires on every Tokens buzz update (INSERT/MODIFY) and
// checks active alert rules for that token, recording in-app triggers on match.
tokensTable.subscribe(
  "AlertEvaluator",
  {
    handler: "packages/jobs/src/alert-evaluator.handler",
    link: allTables,
    timeout: "60 seconds",
    memory: "256 MB",
  },
  { filters: [{ eventName: ["INSERT", "MODIFY"] }] },
);

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
