export const HUM_DEFAULT_MODEL = "claude-sonnet-4-6";
export const HUM_MODELS = ["claude-sonnet-4-6", "claude-opus-4-7"] as const;
export type HumModel = (typeof HUM_MODELS)[number];

export function resolveModel(requested?: string): HumModel {
  if (requested && (HUM_MODELS as readonly string[]).includes(requested)) {
    return requested as HumModel;
  }
  return HUM_DEFAULT_MODEL;
}

export function totalInputTokens(usage: {
  input_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}): number {
  return (usage.input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
}
