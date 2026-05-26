import { auth } from "@clerk/nextjs/server";
import {
  getConversation,
  getMessages,
} from "@monorepo-template/core/db/conversations";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const conversation = await getConversation(userId, id);
  if (!conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await getMessages(userId, id);
  return Response.json({ conversation, messages });
}
