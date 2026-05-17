import type { DynamoDBStreamHandler } from "aws-lambda";
import {
  incrementPulse,
  incrementHourlyHashtags,
  incrementHourlyMentions,
  incrementHourlyDomains,
} from "@monorepo-template/core/db/aggregates";

// Extracts URL domain from a URL string.
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    const newImage = record.dynamodb?.NewImage;
    if (!newImage) continue;

    const query = newImage.query?.S;
    const createdAt = newImage.createdAt?.S;
    const hashtags =
      newImage.hashtags?.L?.map((h: any) => h.S).filter(Boolean) ?? [];
    const mentions =
      newImage.mentions?.L?.map((m: any) => m.S).filter(Boolean) ?? [];
    const urls = newImage.urls?.L?.map((u: any) => u.S).filter(Boolean) ?? [];

    if (!query || !createdAt) continue;

    const ts = new Date(createdAt);
    const minuteBucket = ts.toISOString().slice(0, 16); // "2025-05-16T09:14"
    const hourBucket = ts.toISOString().slice(0, 13); // "2025-05-16T09"

    try {
      await incrementPulse(query, minuteBucket);

      if (hashtags.length > 0) {
        await incrementHourlyHashtags(query, hourBucket, hashtags);
      }
      if (mentions.length > 0) {
        await incrementHourlyMentions(query, hourBucket, mentions);
      }

      const domains = urls.map(extractDomain).filter(Boolean) as string[];
      if (domains.length > 0) {
        await incrementHourlyDomains(query, hourBucket, domains);
      }
    } catch (err) {
      console.error("Aggregator error for record:", err);
    }
  }
};
