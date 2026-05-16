import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Resource } from 'sst'

const raw = new DynamoDBClient({})
export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
})

export const TableNames = {
  tweets:    Resource.Tweets.name,
  aggregates: Resource.Aggregates.name,
  tokens:    Resource.Tokens.name,
  userData:  Resource.UserData.name,
} as const
