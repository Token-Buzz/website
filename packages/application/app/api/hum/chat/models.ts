export const HUM_DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-6";
export const HUM_MODELS = ["us.anthropic.claude-sonnet-4-6"] as const;
export type HumModel = (typeof HUM_MODELS)[number];

export function resolveModel(requested?: string): HumModel {
  if (requested && (HUM_MODELS as readonly string[]).includes(requested)) {
    return requested as HumModel;
  }
  return HUM_DEFAULT_MODEL;
}

// Bedrock Converse TokenUsage fields (all optional → missing/null = 0)
export function totalInputTokens(usage: {
  inputTokens?: number;
  cacheReadInputTokens?: number | null;
  cacheWriteInputTokens?: number | null;
}): number {
  return (usage.inputTokens ?? 0) +
    (usage.cacheReadInputTokens ?? 0) +
    (usage.cacheWriteInputTokens ?? 0);
}

export interface ConverseMessage {
  role: "user" | "assistant";
  content: { text: string }[];
}

// Bedrock Converse requires the first message to be role "user" and roles to
// STRICTLY ALTERNATE user/assistant. The panel's history can start with an
// assistant greeting and contain consecutive same-role turns, which Converse
// rejects with a ValidationException. So: map history → {role,text}, append the
// new user turn, drop any leading assistant turns, then merge consecutive
// same-role turns (join their text with "\n\n").
export function toConverseMessages(
  history: Array<{ from: string; text: string }> | undefined,
  userText: string,
): ConverseMessage[] {
  type Entry = { role: "user" | "assistant"; text: string };

  const entries: Entry[] = (history ?? [])
    .filter(m => m.text && m.text.trim())
    .map(m => ({
      role: m.from === "you" ? "user" : "assistant",
      text: m.text,
    }));

  entries.push({ role: "user", text: userText });

  // Drop leading assistant turns
  while (entries.length > 0 && entries[0].role === "assistant") {
    entries.shift();
  }

  // Merge consecutive same-role turns
  const merged: Entry[] = [];
  for (const entry of entries) {
    if (merged.length > 0 && merged[merged.length - 1].role === entry.role) {
      merged[merged.length - 1].text += "\n\n" + entry.text;
    } else {
      merged.push({ ...entry });
    }
  }

  return merged.map(e => ({ role: e.role, content: [{ text: e.text }] }));
}
