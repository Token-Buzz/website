import type { DynamoDBStreamHandler } from "aws-lambda";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { listAlertsForToken, recordAlertTrigger } from "@monorepo-template/core/db/alerts";
import {
  evaluateRule,
  isInCooldown,
} from "@monorepo-template/core/alerts-eval";
import { snapshotFromImage } from "./alert-evaluator-snapshot";

// Re-export so callers can import snapshotFromImage from a single file.
export { snapshotFromImage } from "./alert-evaluator-snapshot";

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler: DynamoDBStreamHandler = async (event) => {
  const now = Date.now();

  for (const record of event.Records) {
    try {
      // Only process INSERT and MODIFY; ignore REMOVE.
      if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;

      const newImg = record.dynamodb?.NewImage as
        | Record<string, AttributeValue>
        | undefined;

      // Only process token META rows — skip FOLLOWER# snapshots and anything else.
      if (!newImg?.pk?.S?.startsWith("TOKEN#") || newImg?.sk?.S !== "META") continue;

      const current = snapshotFromImage(newImg);
      if (!current) continue;

      // Build prior snapshot from OldImage (null on INSERT — no baseline for sentiment_swing).
      const oldImg = record.dynamodb?.OldImage as
        | Record<string, AttributeValue>
        | undefined;
      const prior = snapshotFromImage(oldImg);

      const rules = await listAlertsForToken(current.sym);

      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (isInCooldown(rule.lastTriggeredAt, now)) continue;

        const res = evaluateRule(rule, current, prior);
        if (!res.triggered) continue;

        await recordAlertTrigger({
          userId: rule.userId,
          alertId: rule.alertId,
          symbol: rule.symbol,
          condition: rule.condition,
          message: res.message,
          value: res.value,
          link: res.link,
        });
      }
    } catch (err) {
      console.error("[alert-evaluator] record processing error:", err);
    }
  }
};
