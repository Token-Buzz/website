import type { DynamoDBStreamHandler } from "aws-lambda";
import { classifySentiment } from "./lib/bedrock.js";
import { updateTweetSentiment } from "@monorepo-template/core/db/tweets";
import {
  incrementHourlySentiment,
  incrementSentimentByQuery,
} from "@monorepo-template/core/db/aggregates";
import { hourBucket as toHourBucket } from "@monorepo-template/core/db/keys";

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const tweetId = newImage.tweetId?.S;
    const query = newImage.query?.S;
    const text = newImage.text?.S;
    const createdAt = newImage.createdAt?.S;

    if (!tweetId || !query || !text || !createdAt) continue;

    try {
      const result = await classifySentiment(text, query);
      const sentiment = result.sentiment === "neutral" ? "neu" : result.sentiment;
      await updateTweetSentiment(tweetId, query, sentiment, result.score);

      const hourBucket = toHourBucket(new Date(createdAt));
      await incrementHourlySentiment(query, hourBucket, sentiment, result.score);
      await incrementSentimentByQuery(query, hourBucket, sentiment);
    } catch (err) {
      console.error("Sentiment error for tweet", tweetId, err);
    }
  }
};
