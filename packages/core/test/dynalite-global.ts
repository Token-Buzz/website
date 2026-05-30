import dynalite from 'dynalite'
import {
  DynamoDBClient,
  CreateTableCommand,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb'
import type { Server } from 'node:http'

// Fixed port shared by globalSetup (server lifecycle) and the per-worker
// setupFiles (env wiring). Both must agree.
const PORT = 8000
const ENDPOINT = `http://127.0.0.1:${PORT}`

// Table definitions replicated from infra/db.ts. Every key attribute (base
// keys + every GSI key) must be declared in AttributeDefinitions. All GSIs
// project ALL and the tables use on-demand billing.
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
        // gsi1pk = BYOK#<provider>, gsi1sk = USER#<userId>
        // Used by listKeyHolders to enumerate all users with a key for a provider.
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

let server: Server | undefined

// Vitest globalSetup: runs once in the main process (not in test workers).
// Its env does NOT propagate to workers — workers get their env from the
// setupFiles module (integration-env.ts). Here we only need the server
// LISTENING and the tables created before the first DB call in any test.
export async function setup(): Promise<void> {
  // createTableMs:0 makes new tables ACTIVE immediately (no CREATING wait).
  server = dynalite({ createTableMs: 0, deleteTableMs: 0, updateTableMs: 0 })

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(PORT, '127.0.0.1', () => resolve())
  })

  const client = new DynamoDBClient({
    endpoint: ENDPOINT,
    region: 'us-east-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  })

  for (const def of TABLES) {
    await client.send(new CreateTableCommand(def))
  }

  client.destroy()
}

export async function teardown(): Promise<void> {
  if (!server) return
  await new Promise<void>((resolve) => {
    server!.close(() => resolve())
  })
}
