export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import {
  getNotificationPrefs,
  setNotificationPrefs,
} from "@monorepo-template/core/db/notification-prefs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await getNotificationPrefs(userId);
  return Response.json(prefs);
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).emailAlerts !== "boolean"
  ) {
    return Response.json(
      { error: "emailAlerts must be a boolean" },
      { status: 400 },
    );
  }

  const { emailAlerts } = body as { emailAlerts: boolean };
  await setNotificationPrefs(userId, { emailAlerts });
  return Response.json({ emailAlerts });
}
