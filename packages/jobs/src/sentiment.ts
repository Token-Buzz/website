import type { DynamoDBStreamHandler } from "aws-lambda";
import { classifySentiment } from "./lib/bedrock.js";
import { updateTweetSentiment } from "@monorepo-template/core/db/tweets";
import { incrementHourlySentiment } from "@monorepo-template/core/db/aggregates";

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
      await updateTweetSentiment(tweetId, query, result.sentiment, result.score);

      const hourBucket = new Date(createdAt).toISOString().slice(0, 13);
      await incrementHourlySentiment(query, hourBucket, result.sentiment, result.score);
    } catch (err) {
      console.error("Sentiment error for tweet", tweetId, err);
    }
  }
};
