import { auth } from "@clerk/nextjs/server";
import { readSocialEvents } from "@monorepo-template/core/db/social-events";
import type { SocialEventType } from "@monorepo-template/core/social-events";

const TYPE_ALIASES: Record<string, SocialEventType> = {
  spike: "SOCIAL_SPIKE",
  kol: "KOL_POST",
  sentiment: "SENTIMENT_SPIKE",
  SOCIAL_SPIKE: "SOCIAL_SPIKE",
  KOL_POST: "KOL_POST",
  SENTIMENT_SPIKE: "SENTIMENT_SPIKE",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const { searchParams } = new URL(req.url);

  const now = Math.floor(Date.now() / 1000);
  const to = parseInt(searchParams.get("to") ?? String(now), 10);
  const from = parseInt(
    searchParams.get("from") ?? String(to - 100 * 86400),
    10,
  );

  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return Response.json({ error: "invalid range" }, { status: 400 });
  }

  // Parse optional comma-separated types, mapping aliases → SocialEventType.
  const typesRaw = searchParams.get("types");
  let types: SocialEventType[] | undefined;
  if (typesRaw) {
    const mapped = typesRaw
      .split(",")
      .map((t) => TYPE_ALIASES[t.trim()])
      .filter((t): t is SocialEventType => t !== undefined);
    if (mapped.length > 0) types = mapped;
    // If none valid, leave types undefined → readSocialEvents defaults to all.
  }

  const events = await readSocialEvents({ symbol, types, from, to });

  return Response.json({ symbol: symbol.toUpperCase(), events });
}
