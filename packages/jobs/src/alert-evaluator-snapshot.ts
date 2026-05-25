/**
 * Pure helper: converts a raw DynamoDB stream attribute-value image into a
 * TokenSnapshot. No DB or SST imports — safe to unit-test without a live stage.
 */
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import type { TokenSnapshot, Sentiment } from "@monorepo-template/core/alerts-eval";

export type { TokenSnapshot };

/**
 * Converts a raw DynamoDB stream image (attribute-value map) into a
 * TokenSnapshot, or returns null when the image is absent or lacks a `sym`.
 */
export function snapshotFromImage(
  img: Record<string, AttributeValue> | undefined,
): TokenSnapshot | null {
  if (!img) return null;
  const sym = img.sym?.S;
  if (!sym) return null;
  return {
    sym,
    dbuzz1h: Number(img.dbuzz1h?.N ?? "0"),
    d24: Number(img.d24?.N ?? "0"),
    sent: (img.sent?.S ?? "neu") as Sentiment,
  };
}
