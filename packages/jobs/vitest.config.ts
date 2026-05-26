import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // No integration tests in jobs; this is a plain unit config.
  },
});
