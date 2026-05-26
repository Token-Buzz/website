import { describe, it, expect } from "vitest";
import { snapshotFromImage } from "./alert-evaluator-snapshot";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";

describe("snapshotFromImage", () => {
  it("returns null for undefined input", () => {
    expect(snapshotFromImage(undefined)).toBeNull();
  });

  it("returns null when sym is missing", () => {
    const img: Record<string, AttributeValue> = {
      pk: { S: "TOKEN#BTC" },
      sk: { S: "META" },
      dbuzz1h: { N: "42" },
    };
    expect(snapshotFromImage(img)).toBeNull();
  });

  it("correctly parses sym, dbuzz1h, d24, and sent from a full image", () => {
    const img: Record<string, AttributeValue> = {
      pk: { S: "TOKEN#SOL" },
      sk: { S: "META" },
      sym: { S: "$SOL" },
      dbuzz1h: { N: "15.5" },
      d24: { N: "-3.2" },
      sent: { S: "bull" },
    };
    const snap = snapshotFromImage(img);
    expect(snap).toEqual({ sym: "$SOL", dbuzz1h: 15.5, d24: -3.2, sent: "bull" });
  });

  it("defaults missing dbuzz1h and d24 to 0", () => {
    const img: Record<string, AttributeValue> = {
      sym: { S: "$PEPE" },
    };
    const snap = snapshotFromImage(img);
    expect(snap).not.toBeNull();
    expect(snap!.dbuzz1h).toBe(0);
    expect(snap!.d24).toBe(0);
  });

  it("defaults missing sent to 'neu'", () => {
    const img: Record<string, AttributeValue> = {
      sym: { S: "$DOGE" },
    };
    const snap = snapshotFromImage(img);
    expect(snap!.sent).toBe("neu");
  });

  it("handles bear sentiment", () => {
    const img: Record<string, AttributeValue> = {
      sym: { S: "$WIF" },
      sent: { S: "bear" },
    };
    expect(snapshotFromImage(img)!.sent).toBe("bear");
  });
});
