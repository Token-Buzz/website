import { auth } from "@clerk/nextjs/server";
import {
  getByokKeyStatus,
  putByokKey,
  deleteByokKey,
  setByokBackgroundPolling,
} from "@monorepo-template/core/db/byok";
import { validateKey } from "@monorepo-template/core/lib/twitter";
import {
  validateRedditCredential,
  encodeRedditCredential,
} from "@monorepo-template/core/lib/reddit";
import { validateKey as validateTelegramCredential } from "@monorepo-template/core/lib/telegram";
import { validateToken as validateDiscordToken } from "@monorepo-template/core/lib/discord";
import { isEnabledProvider, getProvider } from "@monorepo-template/core/providers";

// ── Shared response shape ──────────────────────────────────────────────────────

function keyStatusResponse(
  provider: string,
  status: {
    last4: string;
    validatedAt: string;
    status: "active" | "invalid";
    backgroundPolling: boolean;
  } | null,
) {
  return {
    provider,
    providerName: getProvider(provider)!.name,
    configured: status !== null,
    last4: status?.last4 ?? null,
    validatedAt: status?.validatedAt ?? null,
    status: status?.status ?? null,
    backgroundPolling: status?.backgroundPolling ?? false,
  };
}

// ── Per-provider POST dispatch ─────────────────────────────────────────────────

type PostResult =
  | { ok: true; apiKey: string; last4: string }
  | { ok: false; error: string };

async function validateAndEncodeKey(
  provider: string,
  body: Record<string, unknown>,
): Promise<PostResult> {
  switch (provider) {
    case "twitter": {
      const apiKey = body.apiKey;
      if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
        return { ok: false, error: "apiKey (string) is required" };
      }
      const trimmed = apiKey.trim();
      const { ok } = await validateKey(trimmed);
      if (!ok) {
        return {
          ok: false,
          error: `That API key was rejected by ${getProvider("twitter")!.name}. Double-check it and try again.`,
        };
      }
      return { ok: true, apiKey: trimmed, last4: trimmed.slice(-4) };
    }

    case "reddit": {
      const clientId = body.clientId;
      const clientSecret = body.clientSecret;
      if (
        typeof clientId !== "string" ||
        clientId.trim().length === 0 ||
        typeof clientSecret !== "string" ||
        clientSecret.trim().length === 0
      ) {
        return {
          ok: false,
          error: "clientId and clientSecret (strings) are required",
        };
      }
      const trimmedId = clientId.trim();
      const trimmedSecret = clientSecret.trim();
      const { ok, last4 } = await validateRedditCredential(
        trimmedId,
        trimmedSecret,
      );
      if (!ok) {
        return {
          ok: false,
          error: `Those Reddit credentials were rejected. Check your Client ID and Client secret and try again.`,
        };
      }
      return {
        ok: true,
        apiKey: encodeRedditCredential(trimmedId, trimmedSecret),
        last4,
      };
    }

    case "telegram": {
      const apiId = body.apiId;
      const apiHash = body.apiHash;
      const session = body.session;
      const apiIdNum =
        typeof apiId === "number"
          ? apiId
          : typeof apiId === "string"
            ? Number(apiId.trim())
            : NaN;
      if (
        !Number.isInteger(apiIdNum) ||
        apiIdNum <= 0 ||
        typeof apiHash !== "string" ||
        apiHash.trim().length === 0 ||
        typeof session !== "string" ||
        session.trim().length === 0
      ) {
        return {
          ok: false,
          error: "apiId (number), apiHash and session are required",
        };
      }
      const credential = JSON.stringify({
        apiId: apiIdNum,
        apiHash: apiHash.trim(),
        session: session.trim(),
      });
      const { ok, last4 } = await validateTelegramCredential(credential);
      if (!ok) {
        return {
          ok: false,
          error:
            "Those Telegram credentials were rejected. Check your API ID, API hash, and session string and try again.",
        };
      }
      return { ok: true, apiKey: credential, last4 };
    }

    case "discord": {
      const token = body.token;
      if (typeof token !== "string" || token.trim().length === 0) {
        return { ok: false, error: "token (string) is required" };
      }
      const trimmed = token.trim();
      const { ok, last4 } = await validateDiscordToken(trimmed);
      if (!ok) {
        return {
          ok: false,
          error: "That Discord bot token was rejected. Double-check it and try again.",
        };
      }
      return { ok: true, apiKey: trimmed, last4 };
    }

    default:
      return { ok: false, error: "unsupported_provider" };
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!isEnabledProvider(provider)) {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const status = await getByokKeyStatus(userId, provider);
  return Response.json(keyStatusResponse(provider, status));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!isEnabledProvider(provider)) {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.json();
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = raw as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await validateAndEncodeKey(provider, body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  await putByokKey({
    userId,
    provider,
    apiKey: result.apiKey,
    last4: result.last4,
  });
  const saved = await getByokKeyStatus(userId, provider);

  return Response.json({
    ok: true,
    ...keyStatusResponse(provider, saved),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!isEnabledProvider(provider)) {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

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

  await setByokBackgroundPolling(userId, provider, backgroundPolling);
  const status = await getByokKeyStatus(userId, provider);

  if (status === null) {
    return Response.json({ error: "no key to update" }, { status: 404 });
  }

  return Response.json(keyStatusResponse(provider, status));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await params;
  if (!isEnabledProvider(provider)) {
    return Response.json({ error: "unsupported_provider" }, { status: 400 });
  }

  await deleteByokKey(userId, provider);
  return Response.json({ ok: true });
}
