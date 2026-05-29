// M8 Phase 6 — Saved-query retention sweep.
// Enforces retention by deleting SavedQuery rows whose stored `ttl` is in the
// past. Alpha rows written before TTL was introduced carry no `ttl` attribute
// and are never swept (sweepExpiredSavedQueries skips them). Native DynamoDB
// TTL is also enabled on the UserData table, giving an additional expiry path;
// this Lambda provides deterministic ~daily cleanup regardless of DDB TTL lag.
import type { Handler } from "aws-lambda";
import { sweepExpiredSavedQueries } from "@monorepo-template/core/db/saved-queries";

export const handler: Handler = async () => {
  try {
    const { deleted } = await sweepExpiredSavedQueries();
    console.log(`SavedQuery retention sweep: deleted ${deleted} expired rows`);
  } catch (err) {
    console.error("SavedQuery retention sweep failed:", err);
    throw err;
  }
};
