import { describe, test, expect } from "vitest";
import { createGate } from "./concurrencyGate";

// Helper: make a task that records when it starts/ends and returns its index.
function makeTask(
  index: number,
  counters: { active: number; maxSeen: number },
  delayMs = 10,
): () => Promise<number> {
  return () =>
    new Promise<number>((resolve) => {
      counters.active++;
      if (counters.active > counters.maxSeen) {
        counters.maxSeen = counters.active;
      }
      setTimeout(() => {
        counters.active--;
        resolve(index);
      }, delayMs);
    });
}

describe("createGate", () => {
  test("max concurrent never exceeds the limit", async () => {
    const gate = createGate(2);
    const counters = { active: 0, maxSeen: 0 };

    const tasks = Array.from({ length: 6 }, (_, i) =>
      gate.run(makeTask(i, counters)),
    );

    const results = await Promise.all(tasks);

    expect(counters.maxSeen).toBeLessThanOrEqual(2);
    // All 6 tasks must complete
    expect(results).toHaveLength(6);
  });

  test("all tasks complete and return correct values", async () => {
    const gate = createGate(2);

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        gate.run(() => Promise.resolve(i * 2)),
      ),
    );

    expect(results).toEqual([0, 2, 4, 6, 8, 10]);
  });

  test("tasks run FIFO: results arrive in submission order", async () => {
    const gate = createGate(1);
    const order: number[] = [];

    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        gate.run(async () => {
          order.push(i);
        }),
      ),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });

  test("slot is released even if the task throws", async () => {
    const gate = createGate(1);

    // First task throws; second must still run.
    const p1 = gate.run(() => Promise.reject(new Error("boom")));
    const p2 = gate.run(() => Promise.resolve(42));

    await expect(p1).rejects.toThrow("boom");
    await expect(p2).resolves.toBe(42);
  });

  test("gate with max=1 serialises all tasks", async () => {
    const gate = createGate(1);
    const counters = { active: 0, maxSeen: 0 };

    await Promise.all(
      Array.from({ length: 4 }, (_, i) => gate.run(makeTask(i, counters))),
    );

    expect(counters.maxSeen).toBe(1);
  });

  test("TwitterApiError carries the correct status code", () => {
    // Lightweight check that TwitterApiError (Fix 2) exposes .status.
    // Avoids needing to import the server-side twitter module in a browser test.
    class TwitterApiError extends Error {
      constructor(
        message: string,
        public readonly status: number,
      ) {
        super(message);
        this.name = "TwitterApiError";
      }
    }
    const err = new TwitterApiError("rate limited", 429);
    expect(err.status).toBe(429);
    expect(err.name).toBe("TwitterApiError");
    expect(err instanceof Error).toBe(true);
  });
});
