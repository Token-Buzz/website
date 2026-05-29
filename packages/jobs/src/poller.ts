import type { Handler } from "aws-lambda";
import { getMonitorAssignments } from "@monorepo-template/core/db/monitor-poll";
import { getAdapter } from "@monorepo-template/core/sources/registry";
import { shouldPollNow, markPolled } from "@monorepo-template/core/db/poll-state";
import { handleKeyError } from "./key-errors";

export const handler: Handler = async () => {
  const tasks = await getMonitorAssignments();
  for (const task of tasks) {
    const adapter = getAdapter(task.source);
    if (!adapter || !adapter.implemented) continue;

    // Cadence policy: free/zero-cost sources poll at their floor interval (~2 min),
    // paid/op-heavy sources at coarser floors defined by adapter.pollIntervalMs.
    if (!(await shouldPollNow(task.source, task.query, adapter.pollIntervalMs))) continue;

    try {
      const { ingested } = await adapter.since(task.apiKey, task.query);
      await markPolled(task.source, task.query);
      console.log(`Polled ${ingested} ${task.source} posts for ${task.query} (user ${task.userId})`);
    } catch (err) {
      // handleKeyError needs the source's BYOK provider, not a hardcoded one.
      const provider = adapter.byokProvider;
      if (provider && (await handleKeyError(err, task.userId, provider))) continue;
      console.error(`Poller failed for ${task.source} query ${task.query} (user ${task.userId}):`, err);
    }
  }
};
