import dynalite from 'dynalite'
import {
  DynamoDBClient,
  CreateTableCommand,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb'
import { clerkSetup } from '@clerk/testing/playwright'
import type { Server } from 'node:http'

/**
 * Playwright globalSetup for the authed application E2E suite.
 *
 *  1. Sets the dynalite + SST_RESOURCE env vars on this process (so anything in
 *     THIS process that imports `@monorepo-template/core/db` resolves table
 *     names). The application dev server inherits the same vars via the
 *     `webServer.env` in playwright.application.config.ts.
 *  2. Boots dynalite on port 8000 and creates the five tables + GSIs. This
 *     replicates packages/core/test/dynalite-global.ts — that file lives in
 *     another package's `test/` dir and is not exported from the package, so we
 *     reproduce the minimal table definitions here rather than deep-importing.
 *  3. Runs clerkSetup() to mint the Clerk testing token (uses CLERK_SECRET_KEY +
 *     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY). Requires outbound network to Clerk.
 *
 * Returns a teardown fn that stops dynalite.
 */

const PORT = 8000
const ENDPOINT = `http://127.0.0.1:${PORT}`

// Env values copied from packages/core/test/integration-env.ts.
function setDynaliteEnv(): void {
  process.env.AWS_ENDPOINT_URL_DYNAMODB = ENDPOINT
  process.env.AWS_REGION = 'us-east-1'
  process.env.AWS_DEFAULT_REGION = 'us-east-1'
  process.env.AWS_ACCESS_KEY_ID = 'local'
  process.env.AWS_SECRET_ACCESS_KEY = 'local'
  process.env.SST_RESOURCE_Tweets = JSON.stringify({ name: 'Tweets', type: 'sst.aws.Dynamo' })
  process.env.SST_RESOURCE_Aggregates = JSON.stringify({ name: 'Aggregates', type: 'sst.aws.Dynamo' })
  process.env.SST_RESOURCE_Tokens = JSON.stringify({ name: 'Tokens', type: 'sst.aws.Dynamo' })
  process.env.SST_RESOURCE_UserData = JSON.stringify({ name: 'UserData', type: 'sst.aws.Dynamo' })
  process.env.SST_RESOURCE_Feeds = JSON.stringify({ name: 'Feeds', type: 'sst.aws.Dynamo' })
  process.env.SST_RESOURCE_App = JSON.stringify({ name: 'website', stage: 'test' })
}

// Table definitions replicated from infra/db.ts (mirroring
// packages/core/test/dynalite-global.ts). Every key attribute (base + GSI) is
// declared; GSIs project ALL; tables use on-demand billing.
const TABLES: CreateTableCommandInput[] = [
  {
    TableName: 'Tweets',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
      { AttributeName: 'gsi2pk', AttributeType: 'S' },
      { AttributeName: 'gsi2sk', AttributeType: 'S' },
      { AttributeName: 'gsi3pk', AttributeType: 'S' },
      { AttributeName: 'gsi3sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'QueryByQueryTime',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'QueryByAuthor',
        KeySchema: [
          { AttributeName: 'gsi2pk', KeyType: 'HASH' },
          { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'ByConversation',
        KeySchema: [
          { AttributeName: 'gsi3pk', KeyType: 'HASH' },
          { AttributeName: 'gsi3sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'Aggregates',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TopK',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'Tokens',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
      { AttributeName: 'gsi2pk', AttributeType: 'S' },
      { AttributeName: 'gsi2sk', AttributeType: 'S' },
      { AttributeName: 'gsi3pk', AttributeType: 'S' },
      { AttributeName: 'gsi3sk', AttributeType: 'S' },
      { AttributeName: 'gsi4pk', AttributeType: 'S' },
      { AttributeName: 'gsi4sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'SpikingByDelta',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'WatchlistByMentions',
        KeySchema: [
          { AttributeName: 'gsi2pk', KeyType: 'HASH' },
          { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'SpikingByDelta24h',
        KeySchema: [
          { AttributeName: 'gsi3pk', KeyType: 'HASH' },
          { AttributeName: 'gsi3sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'SpikingByDelta7d',
        KeySchema: [
          { AttributeName: 'gsi4pk', KeyType: 'HASH' },
          { AttributeName: 'gsi4sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'UserData',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ByokHolders',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    TableName: 'Feeds',
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'gsi1pk', AttributeType: 'S' },
      { AttributeName: 'gsi1sk', AttributeType: 'S' },
      { AttributeName: 'gsi2pk', AttributeType: 'S' },
      { AttributeName: 'gsi2sk', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'pk', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'FeedByTokenKindTime',
        KeySchema: [
          { AttributeName: 'gsi1pk', KeyType: 'HASH' },
          { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'FeedByGuid',
        KeySchema: [
          { AttributeName: 'gsi2pk', KeyType: 'HASH' },
          { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
]

async function startDynalite(): Promise<Server | undefined> {
  // createTableMs:0 makes new tables ACTIVE immediately (no CREATING wait).
  const server: Server = dynalite({ createTableMs: 0, deleteTableMs: 0, updateTableMs: 0 })

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        // Idempotent: if something is already listening on the port, reuse it.
        if (err.code === 'EADDRINUSE') {
          resolve()
          return
        }
        reject(err)
      }
      server.once('error', onError)
      server.listen(PORT, '127.0.0.1', () => {
        server.removeListener('error', onError)
        resolve()
      })
    })
  } catch (err) {
    server.close()
    throw err
  }

  // If the port was already in use we never bound, so don't return a handle to
  // a server we can't actually close.
  return server.listening ? server : undefined
}

async function createTables(): Promise<void> {
  const client = new DynamoDBClient({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })

  try {
    for (const def of TABLES) {
      try {
        await client.send(new CreateTableCommand(def))
      } catch (err) {
        // Idempotent: a table left over from a reused dynalite instance is fine.
        if ((err as { name?: string }).name === 'ResourceInUseException') continue
        throw err
      }
    }
  } finally {
    client.destroy()
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  // Fail loudly on missing required Clerk config (repo convention: no silent skips).
  const missing = (
    ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY', 'CLERK_TEST_EMAIL'] as const
  ).filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(
      `[application e2e] Missing required Clerk env var(s): ${missing.join(', ')}. ` +
        `These must be present (pk_test… / sk_test… / a +clerk_test email) to run the authed suite.`,
    )
  }

  setDynaliteEnv()
  const server = await startDynalite()
  await createTables()

  // Mint the Clerk testing token (needs outbound network to the Clerk API).
  await clerkSetup()

  return async () => {
    if (!server) return
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
