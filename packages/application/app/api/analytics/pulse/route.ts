import { auth } from "@clerk/nextjs/server";
import { getPulse } from "@monorepo-template/core/db/aggregates";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const minutes = parseInt(searchParams.get("minutes") ?? "60", 10);
  const window = minutes <= 60 ? "1H" as const : "4H" as const;

  const items = await getPulse(window);
  const series = items.reverse().map(r => ({ bucket: r.bucket, count: r.count }));
  return Response.json({ series });
}
