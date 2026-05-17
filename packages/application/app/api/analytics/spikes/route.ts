import { auth } from "@clerk/nextjs/server";
import { getTopSpikes } from "@monorepo-template/core/db/tokens";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  const spikes = await getTopSpikes(limit);
  return Response.json({ spikes });
}
