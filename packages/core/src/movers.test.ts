import { expect, test, describe } from "vitest";
import { computeBuzzDelta, windowMinuteRange } from "./movers";
import { minuteBucket } from "./db/keys";

test("doubling volume hour-over-hour is +100%", () => {
  expect(computeBuzzDelta(20, 10)).toBe(100);
});

test("a brand-new spike (no prior volume) gets the sentinel", () => {
  expect(computeBuzzDelta(5, 0)).toBe(9999);
});

test("no current and no prior volume yields zero", () => {
  expect(computeBuzzDelta(0, 0)).toBe(0);
});

test("declining volume goes negative", () => {
  expect(computeBuzzDelta(5, 10)).toBe(-50);
});

test("percent change is rounded to an integer", () => {
  expect(computeBuzzDelta(10, 3)).toBe(233);
});

describe("windowMinuteRange", () => {
  // Use a fixed timestamp that is on a clean minute boundary so we can assert
  // exact bucket strings. 2024-01-15T12:00:00Z = 1705320000000 ms.
  const FIXED_NOW = 1705320000000;
  const MIN = 60_000;

  test("1H: returns four correct minute-bucket strings", () => {
    const r = windowMinuteRange("1H", FIXED_NOW);
    expect(r.curTo).toBe(minuteBucket(FIXED_NOW));
    expect(r.curFrom).toBe(minuteBucket(FIXED_NOW - 59 * MIN));
    expect(r.priorTo).toBe(minuteBucket(FIXED_NOW - 60 * MIN));
    expect(r.priorFrom).toBe(minuteBucket(FIXED_NOW - 119 * MIN));
  });

  test("1H: matches legacy spike-materializer math (curFrom=now-59m, priorTo=now-60m)", () => {
    const r = windowMinuteRange("1H", FIXED_NOW);
    // The old code in spike-materializer.ts used exactly these offsets.
    expect(r.curFrom).toBe(minuteBucket(FIXED_NOW - 59 * MIN));
    expect(r.priorTo).toBe(minuteBucket(FIXED_NOW - 60 * MIN));
    expect(r.priorFrom).toBe(minuteBucket(FIXED_NOW - 119 * MIN));
  });

  test("1H: current and prior windows are disjoint (priorTo is exactly one minute before curFrom)", () => {
    const r = windowMinuteRange("1H", FIXED_NOW);
    // Disjoint means curFrom > priorTo by one minute bucket.
    expect(new Date(r.curFrom).getTime()).toBe(new Date(r.priorTo).getTime() + MIN);
  });

  test("24H: window length is 1440 minutes; current/prior windows are disjoint", () => {
    const L = 1440;
    const r = windowMinuteRange("24H", FIXED_NOW);
    expect(r.curTo).toBe(minuteBucket(FIXED_NOW));
    expect(r.curFrom).toBe(minuteBucket(FIXED_NOW - (L - 1) * MIN));
    expect(r.priorTo).toBe(minuteBucket(FIXED_NOW - L * MIN));
    expect(r.priorFrom).toBe(minuteBucket(FIXED_NOW - (2 * L - 1) * MIN));
    // Disjoint boundary.
    expect(new Date(r.curFrom).getTime()).toBe(new Date(r.priorTo).getTime() + MIN);
  });

  test("7D: window length is 10080 minutes; current/prior windows are disjoint", () => {
    const L = 10080;
    const r = windowMinuteRange("7D", FIXED_NOW);
    expect(r.curTo).toBe(minuteBucket(FIXED_NOW));
    expect(r.curFrom).toBe(minuteBucket(FIXED_NOW - (L - 1) * MIN));
    expect(r.priorTo).toBe(minuteBucket(FIXED_NOW - L * MIN));
    expect(r.priorFrom).toBe(minuteBucket(FIXED_NOW - (2 * L - 1) * MIN));
    // Disjoint boundary.
    expect(new Date(r.curFrom).getTime()).toBe(new Date(r.priorTo).getTime() + MIN);
  });

  test("all three windows share the same curTo (now)", () => {
    const expected = minuteBucket(FIXED_NOW);
    expect(windowMinuteRange("1H", FIXED_NOW).curTo).toBe(expected);
    expect(windowMinuteRange("24H", FIXED_NOW).curTo).toBe(expected);
    expect(windowMinuteRange("7D", FIXED_NOW).curTo).toBe(expected);
  });
});
