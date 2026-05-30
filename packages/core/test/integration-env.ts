// Vitest setupFiles: runs in EACH test worker BEFORE the test file's static
// imports are evaluated. This is the only safe place to wire env, because
// packages/core/src/db/client.ts constructs its DynamoDBDocumentClient
// singleton (and reads Resource.<Table>.name) at IMPORT time. globalSetup
// runs in a different process whose env does not reach workers, so the env
// MUST be set here.

// Point the AWS SDK v3 at the local dynalite server. The SDK honors
// AWS_ENDPOINT_URL_DYNAMODB, so client.ts needs no changes.
process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://127.0.0.1:8000'
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_DEFAULT_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'local'
process.env.AWS_SECRET_ACCESS_KEY = 'local'

// SST's Resource proxy reads process.env.SST_RESOURCE_<Name> (a JSON string)
// and exposes `.name`. client.ts reads all four at import time, so all four
// must be present or the import throws. The names map straight onto the
// dynalite tables created in globalSetup.
process.env.SST_RESOURCE_Tweets = JSON.stringify({ name: 'Tweets', type: 'sst.aws.Dynamo' })
process.env.SST_RESOURCE_Aggregates = JSON.stringify({ name: 'Aggregates', type: 'sst.aws.Dynamo' })
process.env.SST_RESOURCE_Tokens = JSON.stringify({ name: 'Tokens', type: 'sst.aws.Dynamo' })
process.env.SST_RESOURCE_UserData = JSON.stringify({ name: 'UserData', type: 'sst.aws.Dynamo' })
process.env.SST_RESOURCE_Feeds = JSON.stringify({ name: 'Feeds', type: 'sst.aws.Dynamo' })
// Defensive: some SST versions read the App resource on first access.
process.env.SST_RESOURCE_App = JSON.stringify({ name: 'website', stage: 'test' })
