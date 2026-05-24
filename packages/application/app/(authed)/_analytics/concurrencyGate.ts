// Promise-based semaphore that caps the number of concurrent in-flight async
// calls. Queued callers are run FIFO as slots free. No external dependencies.

export interface Gate {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createGate(max: number): Gate {
  let active = 0;
  const queue: Array<() => void> = [];

  function tryRelease(): void {
    if (queue.length > 0) {
      // Shift the next waiter and let it acquire immediately (active stays same).
      const next = queue.shift()!;
      next();
    } else {
      active--;
    }
  }

  function acquire(): Promise<void> {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        // active stays at max — slot passes directly to the next waiter.
        resolve();
      });
    });
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        tryRelease();
      }
    },
  };
}
