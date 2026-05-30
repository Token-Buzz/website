import { auth } from "@clerk/nextjs/server";
import { TwitterApiError } from "@monorepo-template/core/lib/twitter";
import { TelegramApiError } from "@monorepo-template/core/lib/telegram";
import { DiscordApiError } from "@monorepo-template/core/lib/discord";
import { ApifyApiError } from "@monorepo-template/core/lib/apify";
import {
  getByokKey,
  getByokKeyStatus,
  markByokKeyInvalid,
} from "@monorepo-template/core/db/byok";
import { canIngestQuery, recordIngestionUsage, getUserPlan } from "@monorepo-template/core/db/usage";
import { getAdapter, allowedSources } from "@monorepo-template/core/sources/registry";
import { isSocialSource, type SocialSource } from "@monorepo-template/core/sources/types";
import { getIngestionSettings } from "@monorepo-template/core/db/ingestion-mode";
import { resolveIngestionMode } from "@monorepo-template/core/sources/ingestion-mode";
import { type City } from "@monorepo-template/core/db/geo";
import citiesData from "@/lib/geo/cities5000.json";

// Load offline city dataset once at module init.
// cities5000.json is a placeholder [] until the dataset is bundled;
// the geo lookup degrades gracefully (skips offline layer, falls through to OpenCage).
const offlineCities = citiesData as unknown as City[];

export async function POST(req: Request) {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Ingestion quota gate ─────────────────────────────────────────────────────
  const quota = await canIngestQuery(userId);
  if (!quota.allowed) {
    return Response.json(
      { error: "quota_exhausted", plan: quota.plan, used: quota.used, limit: quota.limit },
      { status: 402 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("query" in body) ||
    typeof (body as Record<string, unknown>).query !== "string" ||
    !(body as Record<string, unknown>).query
  ) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const query = ((body as Record<string, unknown>).query as string).trim();
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const rawMaxPages =
    "maxPages" in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>).maxPages
      : undefined;
  const maxPages =
    typeof rawMaxPages === "number"
      ? Math.min(Math.max(1, rawMaxPages), 10)
      : 5;

  // ── Parse sources (default to ['twitter']) ─────────────────────────────────
  const rawSources = (body as Record<string, unknown>).sources;
  let requestedSources: SocialSource[];
  if (Array.isArray(rawSources) && rawSources.length > 0) {
    requestedSources = rawSources.filter(isSocialSource);
    if (requestedSources.length === 0) {
      return Response.json({ error: "unsupported_source", unsupported: rawSources }, { status: 400 });
    }
  } else {
    requestedSources = ["twitter"];
  }

  const isSingleSource = requestedSources.length === 1;

  // ── Resolve plan + ingestion settings + allowed sources ───────────────────
  const [{ plan }, settings] = await Promise.all([
    getUserPlan(userId),
    getIngestionSettings(userId),
  ]);
  const modeFor = (s: SocialSource) => resolveIngestionMode(settings, s);
  const allowed = allowedSources(plan);

  // ── Partition into unsupported / locked / runnable ─────────────────────────
  const unsupported: SocialSource[] = [];
  const locked: SocialSource[] = [];
  const runnable: SocialSource[] = [];

  for (const s of requestedSources) {
    const adapter = getAdapter(s, modeFor(s));
    if (!adapter || !adapter.implemented) {
      unsupported.push(s);
    } else if (!allowed.includes(s)) {
      locked.push(s);
    } else {
      runnable.push(s);
    }
  }

  if (runnable.length === 0) {
    if (locked.length > 0) {
      return Response.json({ error: "source_locked", locked, plan }, { status: 403 });
    }
    return Response.json({ error: "unsupported_source", unsupported }, { status: 400 });
  }

  // ── Resolve BYOK keys for each runnable source ─────────────────────────────
  interface SourceKey {
    source: SocialSource;
    apiKey: string;
  }
  interface ByokError {
    source: SocialSource;
    error: "byok_required";
    reason: "missing" | "invalid";
  }

  const sourceKeys: SourceKey[] = [];
  const byokErrors: ByokError[] = [];

  for (const s of runnable) {
    const adapter = getAdapter(s, modeFor(s))!;
    const provider = adapter.byokProvider;

    if (provider === null) {
      // No per-user key needed
      sourceKeys.push({ source: s, apiKey: "" });
      continue;
    }

    const keyStatus = await getByokKeyStatus(userId, provider);
    if (!keyStatus) {
      byokErrors.push({ source: s, error: "byok_required", reason: "missing" });
      continue;
    }
    if (keyStatus.status === "invalid") {
      byokErrors.push({ source: s, error: "byok_required", reason: "invalid" });
      continue;
    }

    const stored = await getByokKey(userId, provider);
    if (!stored) {
      byokErrors.push({ source: s, error: "byok_required", reason: "missing" });
      continue;
    }

    sourceKeys.push({ source: s, apiKey: stored.apiKey });
  }

  // ── Single-source BYOK short-circuit (preserves exact existing contract) ───
  if (isSingleSource && sourceKeys.length === 0 && byokErrors.length > 0) {
    const byokErr = byokErrors[0]!;
    return Response.json({ error: "byok_required", reason: byokErr.reason }, { status: 403 });
  }

  // ── Fan-out ingest ─────────────────────────────────────────────────────────
  interface SourceSuccess {
    source: SocialSource;
    ingested: number;
  }
  interface SourceError {
    source: SocialSource;
    error: string;
    reason?: string;
    detail?: string;
  }

  let anyAttempted = false;
  const ingestResults = await Promise.allSettled(
    sourceKeys.map(async ({ source, apiKey }) => {
      anyAttempted = true;
      const adapter = getAdapter(source, modeFor(source))!;
      const result = await adapter.search(apiKey, query, { maxPages, offlineCities });
      return result;
    }),
  );
  // Note: anyAttempted is set synchronously before allSettled completes; set it
  // based on whether we had any sourceKeys to attempt.
  anyAttempted = sourceKeys.length > 0;

  // ── Record ingestion usage (best-effort) ────────────────────────────────────
  if (anyAttempted) {
    try {
      await recordIngestionUsage(userId);
    } catch {
      /* best-effort */
    }
  }

  // ── Collect per-source outcomes ────────────────────────────────────────────
  const successes: SourceSuccess[] = [];
  const ingestErrors: SourceError[] = [];

  for (let i = 0; i < sourceKeys.length; i++) {
    const { source } = sourceKeys[i]!;
    const adapter = getAdapter(source, modeFor(source))!;
    const settledResult = ingestResults[i]!;

    if (settledResult.status === "fulfilled") {
      successes.push({ source, ingested: settledResult.value.ingested });
    } else {
      const err = settledResult.reason;
      if (
        (err instanceof TwitterApiError ||
          err instanceof TelegramApiError ||
          err instanceof DiscordApiError ||
          err instanceof ApifyApiError) &&
        (err.status === 401 || err.status === 403)
      ) {
        if (adapter.byokProvider) {
          await markByokKeyInvalid(userId, adapter.byokProvider);
        }
        ingestErrors.push({ source, error: "byok_required", reason: "invalid" });
      } else if (err instanceof TwitterApiError && err.status === 429) {
        const detail = err instanceof Error ? err.message : String(err);
        ingestErrors.push({ source, error: "rate_limited", detail });
      } else {
        const detail = err instanceof Error ? err.message : String(err);
        ingestErrors.push({ source, error: "ingest_failed", detail });
      }
    }
  }

  // ── Build bySource map ─────────────────────────────────────────────────────
  const bySource: Record<string, number> = {};
  for (const s of successes) {
    bySource[s.source] = s.ingested;
  }

  const totalIngested = successes.reduce((sum, s) => sum + s.ingested, 0);

  // ── Single-source response (preserves exact existing HTTP contract) ─────────
  if (isSingleSource) {
    const source = requestedSources[0]!;

    // BYOK errors from key resolution phase (no attempt was made)
    if (byokErrors.length > 0) {
      const byokErr = byokErrors[0]!;
      return Response.json({ error: "byok_required", reason: byokErr.reason }, { status: 403 });
    }

    // Ingest-time errors
    if (ingestErrors.length > 0) {
      const ingestErr = ingestErrors[0]!;
      if (ingestErr.error === "byok_required") {
        return Response.json({ error: "byok_required", reason: ingestErr.reason }, { status: 403 });
      }
      if (ingestErr.error === "rate_limited") {
        return Response.json({ error: "rate limited upstream", detail: ingestErr.detail }, { status: 429 });
      }
      // ingest_failed
      const errorMsg = source === "twitter" ? "twitter ingest failed" : `${source} ingest failed`;
      return Response.json({ error: errorMsg, detail: ingestErr.detail }, { status: 502 });
    }

    // Success
    return Response.json({ ingested: totalIngested, query, bySource });
  }

  // ── Multi-source response ──────────────────────────────────────────────────
  // Merge byok errors from key-resolution phase into errors array
  const allErrors: SourceError[] = [
    ...byokErrors.map((e) => ({ source: e.source, error: e.error, reason: e.reason })),
    ...ingestErrors,
  ];

  return Response.json({
    ingested: totalIngested,
    query,
    bySource,
    errors: allErrors,
    locked,
    unsupported,
  });
}
