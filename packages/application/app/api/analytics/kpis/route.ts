import { auth } from "@clerk/nextjs/server";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await listTrackedTokens({ limit: 50 });
  const tokenCount = tokens.length;
  const mentions24h = tokens.reduce((sum, t) => sum + t.mentions, 0);

  let totalSent = 0;
  for (const t of tokens) totalSent += t.sent === "bull" ? 1 : t.sent === "bear" ? -1 : 0;
  const netSentiment = tokenCount > 0 ? Math.round((totalSent / tokenCount) * 100) : 0;

  return Response.json({ mentions24h, tokenCount, netSentiment });
}
