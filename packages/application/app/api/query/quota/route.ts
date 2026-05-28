import { auth } from "@clerk/nextjs/server";
import { canIngestQuery } from "@monorepo-template/core/db/usage";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await canIngestQuery(userId);
  return Response.json(quota);
}
