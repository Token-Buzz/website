import { auth } from "@clerk/nextjs/server";
import {
  appendMessage,
  getConversation,
  type HumRole,
  type HumContextItem,
} from "@monorepo-template/core/db/conversations";

const VALID_ROLES = new Set<HumRole>(["user", "assistant"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role = body.role as HumRole | undefined;
  if (!role || !VALID_ROLES.has(role)) {
    return Response.json(
      { error: "role must be one of: user, assistant" },
      { status: 400 },
    );
  }

  const text =
    typeof body.text === "string" ? body.text : undefined;
  if (!text || text.length === 0) {
    return Response.json(
      { error: "text is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  const conversation = await getConversation(userId, id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const optional: {
    contextItems?: HumContextItem[];
    model?: string;
    tokensIn?: number;
    tokensOut?: number;
  } = {};

  if (Array.isArray(body.contextItems)) {
    optional.contextItems = body.contextItems as HumContextItem[];
  }
  if (typeof body.model === "string") {
    optional.model = body.model;
  }
  if (typeof body.tokensIn === "number") {
    optional.tokensIn = body.tokensIn;
  }
  if (typeof body.tokensOut === "number") {
    optional.tokensOut = body.tokensOut;
  }

  const message = await appendMessage(userId, id, { role, text, ...optional });
  return Response.json({ message }, { status: 201 });
}
