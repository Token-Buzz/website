// DynamoDB table definitions for TokenBuzz Phase 2.
// Key design:
//   Tweets    — PK=QUERY#<query>  SK=TWEET#<tweetId>  GSI1: by tweet ID; stream for aggregator + sentiment
//   Aggregates — PK=QUERY#<query>  SK=AGG#<type>#<bucket>
//   Tokens    — PK=TOKEN#<symbol> SK=<type>#<ts>      GSI1: spike leaderboard
//   UserData  — PK=USER#<userId>  SK=<type>#<id>

export const tweetsTable = new sst.aws.Dynamo("Tweets", {
  fields: {
    pk:     "string",  // QUERY#<query>
    sk:     "string",  // TWEET#<tweetId>
    gsi1pk: "string",  // TWEET#<tweetId>  (reverse lookup)
    gsi1sk: "string",  // <createdAt ISO>
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
  stream: "new-image",
  ttl: "ttl",
});

export const aggregatesTable = new sst.aws.Dynamo("Aggregates", {
  fields: {
    pk: "string",  // QUERY#<query>
    sk: "string",  // AGG#<type>#<bucket>  e.g. AGG#PULSE#2025-05-16T09:14
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});

export const tokensTable = new sst.aws.Dynamo("Tokens", {
  fields: {
    pk:     "string",  // TOKEN#<symbol>
    sk:     "string",  // META | SPIKE#<ts> | FOLLOWER#<ts> | ENGAGEMENT#<tweetId>#<ts>
    gsi1pk: "string",  // SPIKE (constant) — all spikes in one partition for leaderboard
    gsi1sk: "string",  // <deltaScore>#TOKEN#<symbol> — sortable spike rank
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  globalIndexes: {
    gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
  },
});

export const userDataTable = new sst.aws.Dynamo("UserData", {
  fields: {
    pk: "string",  // USER#<userId>
    sk: "string",  // SETTINGS | WATCHLIST#<id> | ALERT#<ts>#<id>
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});
