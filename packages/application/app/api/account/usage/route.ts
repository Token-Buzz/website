import { requireUserId } from "@/app/_auth/requireUserId";
import { canIngestQuery, canUseHum, canRefreshQuery } from "@monorepo-template/core/db/usage";
import { TIERS } from "@monorepo-template/core/billing/tiers";
import { getByokKeyStatus } from "@monorepo-template/core/db/byok";
import { PROVIDERS } from "@monorepo-template/core/providers";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [ingestion, hum, refresh] = await Promise.all([
    canIngestQuery(userId),
    canUseHum(userId),
    canRefreshQuery(userId),
  ]);

  const enabledProviderIds = Object.values(PROVIDERS)
    .filter((p) => p.enabled)
    .map((p) => p.id);

  const keyStatuses = await Promise.all(
    enabledProviderIds.map((id) => getByokKeyStatus(userId, id)),
  );

  const sources = enabledProviderIds.map((id, i) => {
    const status = keyStatuses[i];
    return {
      provider: id,
      providerName: PROVIDERS[id].name,
      configured: status !== null,
      status: status?.status ?? null,
      backgroundPolling: status?.backgroundPolling ?? false,
    };
  });

  return Response.json({
    ingestion: { used: ingestion.used, limit: ingestion.limit },
    hum: { used: hum.used, limit: hum.limit },
    refresh: { used: refresh.used, limit: refresh.limit },
    plan: ingestion.plan,
    period: TIERS[ingestion.plan].period,
    sources,
  });
}
