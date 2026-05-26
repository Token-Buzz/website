import { auth } from "@clerk/nextjs/server";
import {
  listTriggers,
  markTriggerRead,
  markAllTriggersRead,
} from "@monorepo-template/core/db/alerts";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "50", 10),
    100,
  );

  const triggers = await listTriggers(userId, { limit });
  return Response.json({ triggers });
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

  if (body.all === true) {
    await markAllTriggersRead(userId);
    return Response.json({ ok: true });
  }

  if (typeof body.sk === "string" && body.sk.length > 0) {
    await markTriggerRead(userId, body.sk);
    return Response.json({ ok: true });
  }

  return Response.json(
    { error: "body must contain { sk: string } or { all: true }" },
    { status: 400 },
  );
}
