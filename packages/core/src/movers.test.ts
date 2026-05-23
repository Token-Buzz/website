import { expect, test } from "vitest";
import { computeBuzzDelta } from "./movers";

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
