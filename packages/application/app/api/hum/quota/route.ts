import { auth } from "@clerk/nextjs/server";
import { canUseHum } from "@monorepo-template/core/db/usage";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await canUseHum(userId);
  return Response.json(quota);
}
