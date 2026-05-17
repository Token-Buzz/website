import { auth } from "@clerk/nextjs/server";
import { getPulse } from "@monorepo-template/core/db/aggregates";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "$PEPE";
  const minutes = Math.min(parseInt(searchParams.get("minutes") ?? "60", 10), 1440);

  const pulse = await getPulse(query, minutes);
  // Return newest-first (already sorted desc from DDB); reverse for chart display
  const series = pulse.reverse();
  return Response.json({ query, series });
}
