import { auth } from "@clerk/nextjs/server";
import {
  getIngestionSettings,
  setIngestionSettings,
} from "@monorepo-template/core/db/ingestion-mode";
import { sanitizeIngestionSettings } from "@monorepo-template/core/sources/ingestion-mode";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getIngestionSettings(userId);
  return Response.json(settings);
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sanitized = sanitizeIngestionSettings(body);
  await setIngestionSettings(userId, sanitized);
  return Response.json(sanitized);
}
