export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { exportUserData } from "@monorepo-template/core/db/account";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await exportUserData(userId);
    const body = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        userId,
        data,
      },
      null,
      2,
    );
    return new Response(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="tokenbuzz-data-export.json"',
      },
    });
  } catch (error) {
    console.error("[account/export] Failed to export user data:", error);
    return Response.json({ error: "Failed to export data" }, { status: 500 });
  }
}
