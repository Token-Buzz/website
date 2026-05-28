import { describe, it, expect } from "vitest";
import { buildAlertUrl, buildAlertSubject } from "./alert-email";

describe("buildAlertUrl", () => {
  it("prepends app subdomain for relative paths", () => {
    expect(buildAlertUrl("/movers", "tokenbuzz.app")).toBe(
      "https://app.tokenbuzz.app/movers"
    );
  });

  it("returns absolute URLs unchanged", () => {
    expect(buildAlertUrl("https://example.com/foo", "tokenbuzz.app")).toBe(
      "https://example.com/foo"
    );
  });

  it("uses fallback domain when webDomain is undefined", () => {
    expect(buildAlertUrl("/alerts", undefined)).toBe(
      "https://app.tokenbuzz.app/alerts"
    );
  });

  it("handles root path", () => {
    expect(buildAlertUrl("/", "staging.tokenbuzz.app")).toBe(
      "https://app.staging.tokenbuzz.app/"
    );
  });
});

describe("buildAlertSubject", () => {
  it("includes the symbol in the subject", () => {
    expect(buildAlertSubject("BTC")).toBe("TokenBuzz alert: BTC");
  });

  it("preserves symbol casing", () => {
    expect(buildAlertSubject("sol")).toBe("TokenBuzz alert: sol");
  });
});
