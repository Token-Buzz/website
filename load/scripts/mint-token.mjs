/**
 * mint-token.mjs — Mint a short-lived Clerk JWT for load-test runs.
 *
 * Prints ONLY the raw JWT to stdout so callers can capture it:
 *   export AUTH_TOKEN=$(node load/scripts/mint-token.mjs)
 *
 * All diagnostics and errors go to stderr — stdout is the token and nothing else.
 *
 * ONE-TIME SETUP (staging Clerk dashboard, do this once):
 *   Clerk Dashboard → JWT Templates → New template
 *   Name: loadtest  |  Type: Blank  |  Token lifetime: 3600 s
 *   Keep the default "sub" claim (carries the user id).
 *
 * ENV VARS:
 *   CLERK_SECRET_KEY     (required) staging instance secret key (sk_test_…)
 *   CLERK_TEST_EMAIL     (required) the +clerk_test@ address to mint for
 *   CLERK_JWT_TEMPLATE   (optional, default "loadtest") JWT template name
 *   TOKEN_TTL_SECONDS    (optional, default 3600) token lifetime in seconds
 *
 * EXAMPLE:
 *   CLERK_SECRET_KEY=sk_test_… CLERK_TEST_EMAIL=you+clerk_test@example.com \
 *     node load/scripts/mint-token.mjs
 *
 * This is a throwaway harness utility — it is NOT shipped app code.
 */

import { createClerkClient } from "@clerk/backend";

// ---------------------------------------------------------------------------
// Config — read from env
// ---------------------------------------------------------------------------

const secretKey = process.env.CLERK_SECRET_KEY;
const testEmail = process.env.CLERK_TEST_EMAIL;
const template = process.env.CLERK_JWT_TEMPLATE ?? "loadtest";
const ttl = parseInt(process.env.TOKEN_TTL_SECONDS ?? "3600", 10);

// ---------------------------------------------------------------------------
// Validate required env vars
// ---------------------------------------------------------------------------

if (!secretKey) {
  console.error(
    "ERROR: CLERK_SECRET_KEY is not set.\n" +
      "  Set it to the staging instance secret key (sk_test_…).\n" +
      "  In Claude Code web sessions this env var is already present."
  );
  process.exit(1);
}

if (!testEmail) {
  console.error(
    "ERROR: CLERK_TEST_EMAIL is not set.\n" +
      "  Set it to the +clerk_test@ address for the load-test user, e.g.:\n" +
      "  export CLERK_TEST_EMAIL=you+clerk_test@example.com"
  );
  process.exit(1);
}

if (isNaN(ttl) || ttl <= 0) {
  console.error(
    `ERROR: TOKEN_TTL_SECONDS must be a positive integer (got "${process.env.TOKEN_TTL_SECONDS}").`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.error(`[mint-token] template="${template}" ttl=${ttl}s email=${testEmail}`);

const clerk = createClerkClient({ secretKey });

let userId;
try {
  const { data } = await clerk.users.getUserList({ emailAddress: [testEmail] });
  if (!data || data.length === 0) {
    console.error(
      `ERROR: No Clerk user found with email "${testEmail}".\n` +
        "  The +clerk_test user must exist in the STAGING Clerk instance.\n" +
        "  Create it via the Clerk Dashboard (staging) or the Clerk Backend API."
    );
    process.exit(1);
  }
  userId = data[0].id;
  console.error(`[mint-token] found user id=${userId}`);
} catch (err) {
  console.error(`ERROR: getUserList failed: ${err.message ?? err}`);
  process.exit(1);
}

let session;
try {
  session = await clerk.sessions.createSession({ userId });
  console.error(`[mint-token] session id=${session.id}`);
} catch (err) {
  const msg = String(err.message ?? err);
  // 403 / "not allowed" typically means the staging plan disallows Backend session creation.
  if (/403|forbidden|not allowed|unauthorized/i.test(msg)) {
    console.error(
      "ERROR: createSession was rejected (likely 403/forbidden).\n" +
        "  The staging Clerk instance may disallow Backend API session creation on your plan.\n" +
        "  Fallback options:\n" +
        "    Option A: Use @clerk/testing/playwright (see README § Optional — auth token).\n" +
        "    Option B: Copy the __session cookie from a browser sign-in."
    );
  } else {
    console.error(`ERROR: createSession failed: ${msg}`);
  }
  process.exit(1);
}

let token;
try {
  token = await clerk.sessions.getToken(session.id, template, ttl);
  console.error("[mint-token] token minted successfully");
} catch (err) {
  const msg = String(err.message ?? err);
  if (/template/i.test(msg) || /not found/i.test(msg)) {
    console.error(
      `ERROR: getToken failed — JWT template "${template}" may not exist.\n` +
        "  One-time setup: Clerk Dashboard (staging) → JWT Templates → New template\n" +
        `  Name it "${template}", type Blank, lifetime 3600 s.\n` +
        `  Or override: CLERK_JWT_TEMPLATE=<name> node load/scripts/mint-token.mjs`
    );
  } else {
    console.error(`ERROR: getToken failed: ${msg}`);
  }
  process.exit(1);
}

// Print ONLY the JWT to stdout — nothing else — so $() capture works cleanly.
process.stdout.write(token.jwt);
