import { auth, verifyToken } from "@clerk/nextjs/server";
import { headers } from "next/headers";

/**
 * Resolve the authenticated Clerk user id for an API route.
 *
 * Primary path (ALL stages, unchanged): the Clerk session via auth().
 *
 * Load-test fallback (NON-PRODUCTION ONLY): when there is no session, accept a
 * long-lived Clerk JWT presented as `Authorization: Bearer <jwt>` and verify it
 * with the instance secret key, returning its `sub` (the user id). This lets k6
 * load tests authenticate as a real +clerk_test user against pr-/dev stages
 * without the 60-second session-token expiry.
 *
 * Fail-safe gating: the fallback is enabled ONLY when APP_STAGE is set AND not
 * "production". If APP_STAGE is unset or "production", the fallback is disabled,
 * so a misconfigured/unset env can never accidentally enable it in prod.
 */
export async function requireUserId(): Promise<string | null> {
  const { userId } = await auth();
  if (userId) return userId;

  const stage = process.env.APP_STAGE;
  const fallbackAllowed = !!stage && stage !== "production";
  if (!fallbackAllowed) return null;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  const authz = (await headers()).get("authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  if (!token) return null;

  try {
    const claims = await verifyToken(token, { secretKey });
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}
