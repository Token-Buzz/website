import { router } from "./router";
import { webDomain, clerkPublishableKey, clerkSecretKey } from "./secrets";

const isNamedStage = $app.stage === "production" || $app.stage === "dev";

// ── DynamoDB tables ────────────────────────────────────────────────────────

export const tweetsTable = new sst.aws.Dynamo("Tweets", {
    fields: {
        pk:     "string",
        sk:     "string",
        gsi1pk: "string",
        gsi1sk: "string",
        gsi2pk: "string",
        gsi2sk: "string",
        gsi3pk: "string",
        gsi3sk: "string",
    },
    primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    globalIndexes: {
        QueryByQueryTime: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
        QueryByAuthor:    { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
        ByConversation:   { hashKey: "gsi3pk", rangeKey: "gsi3sk" },
    },
    stream: "new-and-old-images",
});

export const aggregatesTable = new sst.aws.Dynamo("Aggregates", {
    fields: {
        pk:     "string",
        sk:     "string",
        gsi1pk: "string",
        gsi1sk: "string",
    },
    primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    globalIndexes: {
        TopK: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
    },
});

export const tokensTable = new sst.aws.Dynamo("Tokens", {
    fields: {
        pk:     "string",
        sk:     "string",
        gsi1pk: "string",
        gsi1sk: "string",
        gsi2pk: "string",
        gsi2sk: "string",
    },
    primaryIndex: { hashKey: "pk", rangeKey: "sk" },
    globalIndexes: {
        SpikingByDelta:      { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
        WatchlistByMentions: { hashKey: "gsi2pk", rangeKey: "gsi2sk" },
    },
});

export const userDataTable = new sst.aws.Dynamo("UserData", {
    fields: {
        pk: "string",
        sk: "string",
    },
    primaryIndex: { hashKey: "pk", rangeKey: "sk" },
});

// ── Next.js application ────────────────────────────────────────────────────

export const app = new sst.aws.Nextjs("Application", {
    path: "packages/application",
    router: isNamedStage
        ? {
              instance: router,
              domain: $app.stage === "production"
                  ? $interpolate`app.${webDomain.value}`
                  : $interpolate`app-dev.${webDomain.value}`,
          }
        : undefined,
    environment: {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey.value,
        CLERK_SECRET_KEY: clerkSecretKey.value,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/dashboard",
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/dashboard",
    },
    link: [tweetsTable, aggregatesTable, tokensTable, userDataTable],
});
