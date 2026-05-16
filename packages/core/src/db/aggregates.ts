import { PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ddb } from "./client.js";

export type PulsePoint = {
  bucket: string;  // minute bucket e.g. "2025-05-16T09:14"
  count: number;
};

export type HourlySentiment = {
  bucket: string;  // hour bucket e.g. "2025-05-16T09"
  bullCount: number;
  neutralCount: number;
  bearCount: number;
  totalScore: number;
  tweetCount: number;
};

export type TopItem = { name: string; count: number };

// Flat SK pattern: AGG#<TYPE>#<bucket>#<item> — one row per item, ADD count atomically.
// This avoids DDB's limitation that ADD doesn't work on nested map attributes.

export async function incrementPulse(query: string, bucket: string): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName: Resource.Aggregates.name,
    Key: { pk: `QUERY#${query}`, sk: `AGG#PULSE#${bucket}` },
    UpdateExpression: "ADD #count :inc",
    ExpressionAttributeNames: { "#count": "count" },
    ExpressionAttributeValues: { ":inc": 1 },
  }));
}

export async function incrementHourlyHashtags(query: string, bucket: string, hashtags: string[]): Promise<void> {
  await Promise.all(hashtags.map(tag =>
    ddb.send(new UpdateCommand({
      TableName: Resource.Aggregates.name,
      Key: { pk: `QUERY#${query}`, sk: `AGG#HOUR_HASHTAG#${bucket}#${tag.toLowerCase()}` },
      UpdateExpression: "ADD #count :inc SET #name = :name",
      ExpressionAttributeNames: { "#count": "count", "#name": "name" },
      ExpressionAttributeValues: { ":inc": 1, ":name": tag },
    }))
  ));
}

export async function incrementHourlyMentions(query: string, bucket: string, mentions: string[]): Promise<void> {
  await Promise.all(mentions.map(m =>
    ddb.send(new UpdateCommand({
      TableName: Resource.Aggregates.name,
      Key: { pk: `QUERY#${query}`, sk: `AGG#HOUR_MENTION#${bucket}#${m.toLowerCase()}` },
      UpdateExpression: "ADD #count :inc SET #name = :name",
      ExpressionAttributeNames: { "#count": "count", "#name": "name" },
      ExpressionAttributeValues: { ":inc": 1, ":name": m },
    }))
  ));
}

export async function incrementHourlyDomains(query: string, bucket: string, domains: string[]): Promise<void> {
  await Promise.all(domains.map(d =>
    ddb.send(new UpdateCommand({
      TableName: Resource.Aggregates.name,
      Key: { pk: `QUERY#${query}`, sk: `AGG#HOUR_DOMAIN#${bucket}#${d.toLowerCase()}` },
      UpdateExpression: "ADD #count :inc SET #name = :name",
      ExpressionAttributeNames: { "#count": "count", "#name": "name" },
      ExpressionAttributeValues: { ":inc": 1, ":name": d },
    }))
  ));
}

export async function incrementHourlySentiment(
  query: string,
  bucket: string,
  sentiment: "bull" | "bear" | "neutral",
  score: number
): Promise<void> {
  const countAttr = sentiment === "bull" ? "bullCount" : sentiment === "bear" ? "bearCount" : "neutralCount";
  await ddb.send(new UpdateCommand({
    TableName: Resource.Aggregates.name,
    Key: { pk: `QUERY#${query}`, sk: `AGG#HOUR_SENTIMENT#${bucket}` },
    UpdateExpression: "ADD #cnt :one, totalScore :score, tweetCount :one",
    ExpressionAttributeNames: { "#cnt": countAttr },
    ExpressionAttributeValues: { ":one": 1, ":score": score },
  }));
}

export async function getPulse(query: string, minuteCount = 60): Promise<PulsePoint[]> {
  const result = await ddb.send(new QueryCommand({
    TableName: Resource.Aggregates.name,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `QUERY#${query}`, ":prefix": "AGG#PULSE#" },
    ScanIndexForward: false,
    Limit: minuteCount,
  }));
  return (result.Items ?? []).map((item: any) => ({
    bucket: (item.sk as string).replace("AGG#PULSE#", ""),
    count: item.count ?? 0,
  }));
}

export async function getHourlySentiment(query: string, hourCount = 24): Promise<HourlySentiment[]> {
  const result = await ddb.send(new QueryCommand({
    TableName: Resource.Aggregates.name,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `QUERY#${query}`, ":prefix": "AGG#HOUR_SENTIMENT#" },
    ScanIndexForward: false,
    Limit: hourCount,
  }));
  return (result.Items ?? []).map((item: any) => ({
    bucket: (item.sk as string).replace("AGG#HOUR_SENTIMENT#", ""),
    bullCount: item.bullCount ?? 0,
    neutralCount: item.neutralCount ?? 0,
    bearCount: item.bearCount ?? 0,
    totalScore: item.totalScore ?? 0,
    tweetCount: item.tweetCount ?? 0,
  }));
}

// Returns top items (hashtags, mentions, or domains) for a given bucket prefix.
export async function getTopHourlyItems(
  query: string,
  type: "HOUR_HASHTAG" | "HOUR_MENTION" | "HOUR_DOMAIN",
  bucket: string,
  limit = 10
): Promise<TopItem[]> {
  const result = await ddb.send(new QueryCommand({
    TableName: Resource.Aggregates.name,
    KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
    ExpressionAttributeValues: { ":pk": `QUERY#${query}`, ":prefix": `AGG#${type}#${bucket}#` },
  }));
  const items: TopItem[] = (result.Items ?? []).map((item: any) => ({
    name: item.name as string,
    count: item.count ?? 0,
  }));
  items.sort((a, b) => b.count - a.count);
  return items.slice(0, limit);
}

export async function writeDailyRollup(query: string, dayBucket: string, data: Record<string, unknown>): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: Resource.Aggregates.name,
    Item: { pk: `QUERY#${query}`, sk: `AGG#DAY_ROLLUP#${dayBucket}`, ...data },
  }));
}
