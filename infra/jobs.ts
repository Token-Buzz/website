import { tweetsTable, aggregatesTable, tokensTable, userDataTable } from "./db";

const twitterApiKey = new sst.Secret("TwitterApiKey");

const allTables = [tweetsTable, aggregatesTable, tokensTable, userDataTable];

const BEDROCK_HAIKU_ARN = [
  "arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
  "arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0",
];

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

// 2. DDB Streams aggregator — INSERT fan-out to Aggregates table
tweetsTable.subscribe(
  "Aggregator",
  {
    handler: "packages/jobs/src/aggregator.handler",
    link: [aggregatesTable],
    timeout: "60 seconds",
  },
  { filters: [{ eventName: ["INSERT"] }] },
);

// 3. Sentiment dispatcher — separate stream consumer; Bedrock IAM scoped only here
tweetsTable.subscribe(
  "SentimentDispatcher",
  {
    handler: "packages/jobs/src/sentiment.handler",
    link: [tweetsTable, aggregatesTable],
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

// 6. Spike materializer — every 5 minutes
new sst.aws.Cron("SpikeMaterializer", {
  schedule: "rate(5 minutes)",
  function: {
    handler: "packages/jobs/src/spike-materializer.handler",
    link: [aggregatesTable, tokensTable],
    timeout: "60 seconds",
    memory: "256 MB",
  },
});

// 7. Daily rollup — 00:15 UTC
new sst.aws.Cron("DailyRollup", {
  schedule: "cron(15 0 * * ? *)",
  function: {
    handler: "packages/jobs/src/daily-rollup.handler",
    link: [aggregatesTable, tokensTable],
    timeout: "300 seconds",
    memory: "256 MB",
  },
});
