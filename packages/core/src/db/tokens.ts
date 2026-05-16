import {
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ddb } from "./client.js";

export type TokenMeta = {
  symbol: string;
  name?: string;
  tracked: boolean;
};

export type TokenSpike = {
  symbol: string;
  deltaScore: number;
  currentMentions: number;
  priorMentions: number;
  computedAt: string;
};

export type FollowerSnapshot = {
  symbol: string;
  authorUsername: string;
  followers: number;
  following: number;
  snappedAt: string;
};

export async function upsertTokenMeta(meta: TokenMeta): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Tokens.name,
      Key: {
        pk: `TOKEN#${meta.symbol}`,
        sk: "META",
      },
      UpdateExpression: "SET #name = :name, tracked = :tracked",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: {
        ":name": meta.name || null,
        ":tracked": meta.tracked,
      },
    })
  );
}

export async function writeSpike(spike: TokenSpike): Promise<void> {
  const padded = String(Math.round(spike.deltaScore))
    .padStart(10, "0");
  const ts = new Date(spike.computedAt).getTime();

  await ddb.send(
    new PutCommand({
      TableName: Resource.Tokens.name,
      Item: {
        pk: `TOKEN#${spike.symbol}`,
        sk: `SPIKE#${ts}`,
        gsi1pk: "SPIKE",
        gsi1sk: `${padded}#TOKEN#${spike.symbol}`,
        symbol: spike.symbol,
        deltaScore: spike.deltaScore,
        currentMentions: spike.currentMentions,
        priorMentions: spike.priorMentions,
        computedAt: spike.computedAt,
      },
    })
  );
}

export async function writeFollowerSnapshot(
  snapshot: FollowerSnapshot
): Promise<void> {
  const ts = new Date(snapshot.snappedAt).getTime();

  await ddb.send(
    new PutCommand({
      TableName: Resource.Tokens.name,
      Item: {
        pk: `TOKEN#${snapshot.symbol}`,
        sk: `FOLLOWER#${ts}`,
        symbol: snapshot.symbol,
        authorUsername: snapshot.authorUsername,
        followers: snapshot.followers,
        following: snapshot.following,
        snappedAt: snapshot.snappedAt,
      },
    })
  );
}

export async function getTopSpikes(limit: number = 50): Promise<TokenSpike[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Resource.Tokens.name,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": "SPIKE",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (result.Items || []).map((item: any) => ({
    symbol: item.symbol,
    deltaScore: item.deltaScore,
    currentMentions: item.currentMentions,
    priorMentions: item.priorMentions,
    computedAt: item.computedAt,
  }));
}

// Scans META rows — small table in practice (hundreds of tokens max).
export async function getTrackedTokens(): Promise<string[]> {
  const symbols: string[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const result = await ddb.send(new ScanCommand({
      TableName: Resource.Tokens.name,
      FilterExpression: "sk = :meta AND tracked = :t",
      ExpressionAttributeValues: { ":meta": "META", ":t": true },
      ProjectionExpression: "pk",
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    (result.Items ?? []).forEach((item: any) => {
      symbols.push((item.pk as string).replace("TOKEN#", ""));
    });
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return symbols;
}
