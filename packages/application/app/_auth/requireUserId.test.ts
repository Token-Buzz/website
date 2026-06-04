import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

import { auth, verifyToken } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { requireUserId } from "./requireUserId";

const mockAuth = vi.mocked(auth);
const mockVerifyToken = vi.mocked(verifyToken);
const mockHeaders = vi.mocked(headers);

/** Build a minimal ReadonlyHeaders-like object for the "no auth header" case. */
function makeHeaders(authorization?: string) {
  return {
    get: (name: string) =>
      name.toLowerCase() === "authorization" ? (authorization ?? null) : null,
  } as unknown as ReturnType<typeof headers> extends Promise<infer H> ? H : never;
}

// ── Env management ───────────────────────────────────────────────────────────

let savedStage: string | undefined;
let savedSecretKey: string | undefined;

beforeEach(() => {
  savedStage = process.env.APP_STAGE;
  savedSecretKey = process.env.CLERK_SECRET_KEY;
  vi.clearAllMocks();
});

afterEach(() => {
  if (savedStage === undefined) {
    delete process.env.APP_STAGE;
  } else {
    process.env.APP_STAGE = savedStage;
  }
  if (savedSecretKey === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = savedSecretKey;
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requireUserId", () => {
  test("case 1: session present → returns that userId; verifyToken is NOT called", async () => {
    mockAuth.mockResolvedValue({ userId: "user_session123" } as Awaited<ReturnType<typeof auth>>);
    // headers should not even be called in this path
    mockHeaders.mockResolvedValue(makeHeaders() as Awaited<ReturnType<typeof headers>>);

    const result = await requireUserId();

    expect(result).toBe("user_session123");
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test("case 2: no session, APP_STAGE='production', valid Bearer present → returns null (prod never uses fallback)", async () => {
    process.env.APP_STAGE = "production";
    process.env.CLERK_SECRET_KEY = "sk_test_secret";

    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    mockHeaders.mockResolvedValue(
      makeHeaders("Bearer eyJhbGciOiJSUzI1NiJ9.valid.token") as Awaited<ReturnType<typeof headers>>,
    );

    const result = await requireUserId();

    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test("case 3: no session, APP_STAGE unset → returns null (fail-safe)", async () => {
    delete process.env.APP_STAGE;
    process.env.CLERK_SECRET_KEY = "sk_test_secret";

    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    mockHeaders.mockResolvedValue(
      makeHeaders("Bearer eyJhbGciOiJSUzI1NiJ9.valid.token") as Awaited<ReturnType<typeof headers>>,
    );

    const result = await requireUserId();

    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test("case 4: no session, APP_STAGE='pr-5', valid Bearer → returns the token's sub", async () => {
    process.env.APP_STAGE = "pr-5";
    process.env.CLERK_SECRET_KEY = "sk_test_secret";

    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    mockHeaders.mockResolvedValue(
      makeHeaders("Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig") as Awaited<ReturnType<typeof headers>>,
    );
    mockVerifyToken.mockResolvedValue({ sub: "user_jwt_pr5" } as Awaited<ReturnType<typeof verifyToken>>);

    const result = await requireUserId();

    expect(result).toBe("user_jwt_pr5");
    expect(mockVerifyToken).toHaveBeenCalledWith("eyJhbGciOiJSUzI1NiJ9.payload.sig", {
      secretKey: "sk_test_secret",
    });
  });

  test("case 5: no session, APP_STAGE='pr-5', verifyToken throws (invalid/expired) → returns null", async () => {
    process.env.APP_STAGE = "pr-5";
    process.env.CLERK_SECRET_KEY = "sk_test_secret";

    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    mockHeaders.mockResolvedValue(
      makeHeaders("Bearer bad.token.here") as Awaited<ReturnType<typeof headers>>,
    );
    mockVerifyToken.mockRejectedValue(new Error("Token verification failed"));

    const result = await requireUserId();

    expect(result).toBeNull();
  });

  test("case 6: no session, APP_STAGE='pr-5', no Authorization header → returns null", async () => {
    process.env.APP_STAGE = "pr-5";
    process.env.CLERK_SECRET_KEY = "sk_test_secret";

    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);
    // No Authorization header
    mockHeaders.mockResolvedValue(makeHeaders() as Awaited<ReturnType<typeof headers>>);

    const result = await requireUserId();

    expect(result).toBeNull();
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });
});
