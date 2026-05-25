import { auth } from "@clerk/nextjs/server";
import { deleteByokKey } from "@monorepo-template/core/db/byok";
import { isEnabledProvider } from "@monorepo-template/core/providers";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;

  if (!isEnabledProvider(provider)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }

  await deleteByokKey(userId, provider);
  return Response.json({ ok: true });
}
