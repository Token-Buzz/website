import { auth } from "@clerk/nextjs/server";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { resolveModel } from "../chat/_models";
import { canUseHum, recordHumUsage } from "@monorepo-template/core/db/usage";
import { buildBriefPrompt, parseBriefResponse, type BriefSignals } from "@/app/(authed)/_dashboard/brief";

const client = new BedrockRuntimeClient({ region: "us-east-1" });

const SYSTEM_PROMPT = `You are Hum, TokenBuzz's crypto social intelligence assistant. Write a concise morning brief of 2–4 sentences about what matters in the user's watchlist today, grounded ONLY in the signals provided. Highlight the most significant buzz changes, sentiment shifts, or narrative developments. Never invent data, never speculate beyond the provided signals, and never give financial advice. Then propose 2–3 short follow-up questions the user might want to ask. Respond as strict JSON in this exact format: {"brief": string, "quickAsks": string[]}`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const quota = await canUseHum(userId);
    if (!quota.allowed) {
      return Response.json(
        { error: "quota_exhausted", plan: quota.plan, used: quota.used, limit: quota.limit },
        { status: 402 },
      );
    }

    const body = await req.json() as BriefSignals;

    const userMessage = buildBriefPrompt(body);
    const model = resolveModel(undefined);

    const response = await client.send(
      new ConverseCommand({
        modelId: model,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [{ role: "user", content: [{ text: userMessage }] }],
        inferenceConfig: { maxTokens: 600 },
      }),
    );

    const rawText = response.output?.message?.content?.[0]?.text ?? "";
    const { brief, quickAsks } = parseBriefResponse(rawText);

    // Best-effort usage recording — a failure must not prevent the response.
    try {
      await recordHumUsage(userId);
    } catch {
      /* swallow */
    }

    return Response.json({ brief, quickAsks });
  } catch (err) {
    console.error("[hum/brief] Bedrock error", err);
    return Response.json({ error: "brief_failed" }, { status: 502 });
  }
}
