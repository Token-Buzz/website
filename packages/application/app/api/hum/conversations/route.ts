import { auth } from "@clerk/nextjs/server";
import {
  createConversation,
  listConversations,
} from "@monorepo-template/core/db/conversations";

export async function GET(_req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await listConversations(userId);
  return Response.json({ conversations });
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

  let title: string | undefined;
  if ("title" in body) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return Response.json(
        { error: "title must be a non-empty string" },
        { status: 400 },
      );
    }
    title = body.title.trim();
  }

  const conversation = await createConversation(
    userId,
    title ? { title } : undefined,
  );
  return Response.json({ conversation }, { status: 201 });
}
