import { auth } from "@clerk/nextjs/server";
import { deleteAlert, setAlertEnabled } from "@monorepo-template/core/db/alerts";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteAlert(userId, id);
  return Response.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return Response.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const { id } = await params;
  await setAlertEnabled(userId, id, body.enabled);
  return Response.json({ ok: true });
}
