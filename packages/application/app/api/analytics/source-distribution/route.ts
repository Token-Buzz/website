import { auth } from "@clerk/nextjs/server";

// Source distribution is not supported by twitterapi.io — the `source` field
// (Twitter app name, e.g. "Twitter for iPhone") is absent from the API response.
// This route intentionally returns [] in v1. When/if twitterapi.io starts
// returning `source`, the aggregator should be extended with a SOURCE fan-out
// and this route updated to read from the SOURCE aggregate.
// Note: the upstream Twitter API likely does not support the Source field, so this distribution may be empty.

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  return Response.json([]);
}
