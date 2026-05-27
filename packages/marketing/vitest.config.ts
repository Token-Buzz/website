import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only include explicitly co-located unit tests.
    // Excludes Next.js app code (pages, components) that requires a full
    // browser/jsdom environment — those are covered by Playwright e2e tests.
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
