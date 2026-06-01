import { auth } from "@clerk/nextjs/server";
import { getTokenProfile } from "@monorepo-template/core/db/token-profile";

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol } = await params;
  const profile = await getTokenProfile(symbol);
  return Response.json({ profile });
}
