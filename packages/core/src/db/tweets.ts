import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ddb } from "./client.js";

export type Tweet = {
  tweetId: string;
  query: string;
  text: string;
  authorUsername: string;
  authorId: string;
  authorName: string;
  authorFollowers: number;
  authorProfilePicture?: string;
  createdAt: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  viewCount: number;
  bookmarkCount: number;
  lang: string;
  isReply: boolean;
  hashtags: string[];
  mentions: string[];
  urls: string[];
  sentiment?: "bull" | "bear" | "neutral";
  sentimentScore?: number;
  ttl?: number;
};

export async function putTweet(tweet: Tweet): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await ddb.send(
    new PutCommand({
      TableName: Resource.Tweets.name,
      Item: {
        pk: `QUERY#${tweet.query}`,
        sk: `TWEET#${tweet.tweetId}`,
        gsi1pk: `TWEET#${tweet.tweetId}`,
        gsi1sk: tweet.createdAt,
        ttl,
        ...tweet,
      },
    })
  );
}

export async function updateTweetSentiment(
  tweetId: string,
  query: string,
  sentiment: "bull" | "bear" | "neutral",
  sentimentScore: number
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Tweets.name,
      Key: {
        pk: `QUERY#${query}`,
        sk: `TWEET#${tweetId}`,
      },
      UpdateExpression: "SET sentiment = :sentiment, sentimentScore = :score",
      ExpressionAttributeValues: {
        ":sentiment": sentiment,
        ":score": sentimentScore,
      },
    })
  );
}

export async function getRecentTweets(
  query: string,
  limit: number = 100
): Promise<Tweet[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Resource.Tweets.name,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `QUERY#${query}`,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return (result.Items as Tweet[]) || [];
}

export async function getLatestTweetId(query: string): Promise<string | null> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Resource.Tweets.name,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `QUERY#${query}`,
      },
      ScanIndexForward: false,
      Limit: 1,
      ProjectionExpression: "sk",
    })
  );
  const item = result.Items?.[0];
  if (!item) return null;
  const sk = item.sk as string;
  return sk.replace(/^TWEET#/, "");
}

export async function getTweetCount(query: string): Promise<number> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: Resource.Tweets.name,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `QUERY#${query}`,
      },
      Select: "COUNT",
    })
  );
  return result.Count || 0;
}
