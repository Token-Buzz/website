import { auth } from "@clerk/nextjs/server";
import { getByokKeyStatus, putByokKey, TWITTER_PROVIDER } from "@monorepo-template/core/db/byok";
import { validateKey } from "@monorepo-template/core/lib/twitter";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getByokKeyStatus(userId, TWITTER_PROVIDER);
  return Response.json({
    provider: TWITTER_PROVIDER,
    configured: status !== null,
    last4: status?.last4 ?? null,
    validatedAt: status?.validatedAt ?? null,
    status: status?.status ?? null,
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey =
    body !== null && typeof body === "object" && "apiKey" in body
      ? (body as Record<string, unknown>).apiKey
      : undefined;

  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  const trimmed = apiKey.trim();
  const { ok } = await validateKey(trimmed);

  if (!ok) {
    return Response.json(
      { error: "That API key was rejected by twitterapi.io. Double-check it and try again." },
      { status: 400 },
    );
  }

  await putByokKey({ userId, provider: TWITTER_PROVIDER, apiKey: trimmed });
  const saved = await getByokKeyStatus(userId, TWITTER_PROVIDER);

  return Response.json({
    provider: TWITTER_PROVIDER,
    configured: true,
    last4: saved!.last4,
    validatedAt: saved!.validatedAt,
    status: saved!.status,
  });
}
