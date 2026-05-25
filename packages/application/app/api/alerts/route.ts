import { auth } from "@clerk/nextjs/server";
import {
  createAlert,
  listAlerts,
  type AlertRule,
  type AlertCondition,
  type SentimentTarget,
} from "@monorepo-template/core/db/alerts";

const VALID_CONDITIONS = new Set<AlertCondition>([
  "mention_spike",
  "sentiment_swing",
  "price_move",
]);

const VALID_TARGETS = new Set<SentimentTarget>(["bull", "bear", "any"]);

interface AlertRuleDTO {
  id: string;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  target: SentimentTarget | undefined;
  channel: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | undefined;
}

function toRuleDTO(rule: AlertRule): AlertRuleDTO {
  return {
    id: rule.alertId,
    symbol: rule.symbol,
    condition: rule.condition,
    threshold: rule.threshold,
    target: rule.target,
    channel: rule.channel,
    enabled: rule.enabled,
    createdAt: rule.createdAt,
    lastTriggeredAt: rule.lastTriggeredAt,
  };
}

export async function GET(_req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await listAlerts(userId);
  return Response.json({ alerts: alerts.map(toRuleDTO) });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol =
    typeof body.symbol === "string" ? body.symbol.trim() : undefined;
  if (!symbol) {
    return Response.json(
      { error: "symbol is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const condition = body.condition as AlertCondition | undefined;
  if (!condition || !VALID_CONDITIONS.has(condition)) {
    return Response.json(
      {
        error:
          "condition must be one of: mention_spike, sentiment_swing, price_move",
      },
      { status: 400 },
    );
  }

  let threshold: number;
  let target: SentimentTarget | undefined;

  if (condition === "sentiment_swing") {
    const rawThreshold = body.threshold;
    threshold =
      rawThreshold !== undefined && rawThreshold !== null
        ? Number(rawThreshold)
        : 0;

    const rawTarget = body.target;
    if (rawTarget !== undefined && rawTarget !== null) {
      if (typeof rawTarget !== "string" || !VALID_TARGETS.has(rawTarget as SentimentTarget)) {
        return Response.json(
          { error: "target must be one of: bull, bear, any" },
          { status: 400 },
        );
      }
      target = rawTarget as SentimentTarget;
    } else {
      target = "any";
    }
  } else {
    // mention_spike or price_move: threshold required and > 0
    const rawThreshold = body.threshold;
    if (rawThreshold === undefined || rawThreshold === null) {
      return Response.json(
        { error: "threshold is required for this condition" },
        { status: 400 },
      );
    }
    threshold = Number(rawThreshold);
    if (!isFinite(threshold) || threshold <= 0) {
      return Response.json(
        { error: "threshold must be a finite number greater than 0" },
        { status: 400 },
      );
    }
  }

  const alert = await createAlert({ userId, symbol, condition, threshold, target });
  return Response.json({ alert: toRuleDTO(alert) }, { status: 201 });
}
