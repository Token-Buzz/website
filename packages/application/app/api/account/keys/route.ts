import { auth } from "@clerk/nextjs/server";
import {
  getByokKeyStatus,
  putByokKey,
  setByokBackgroundPolling,
  TWITTER_PROVIDER,
} from "@monorepo-template/core/db/byok";
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
    backgroundPolling: status?.backgroundPolling ?? false,
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
    backgroundPolling: saved!.backgroundPolling,
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const backgroundPolling =
    body !== null && typeof body === "object" && "backgroundPolling" in body
      ? (body as Record<string, unknown>).backgroundPolling
      : undefined;

  if (typeof backgroundPolling !== "boolean") {
    return Response.json(
      { error: "backgroundPolling (boolean) required" },
      { status: 400 },
    );
  }

  await setByokBackgroundPolling(userId, TWITTER_PROVIDER, backgroundPolling);
  const status = await getByokKeyStatus(userId, TWITTER_PROVIDER);

  if (status === null) {
    return Response.json({ error: "no key to update" }, { status: 404 });
  }

  return Response.json({
    provider: TWITTER_PROVIDER,
    configured: true,
    last4: status.last4,
    validatedAt: status.validatedAt,
    status: status.status,
    backgroundPolling: status.backgroundPolling,
  });
}
