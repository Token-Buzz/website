import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/*.integration.test.ts'],
    // Server lifecycle (dynalite start/stop + table creation) runs once in
    // the main process.
    globalSetup: ['./test/dynalite-global.ts'],
    // Per-worker env wiring (endpoint, creds, SST_RESOURCE_*) runs before the
    // test file's static imports — required because client.ts builds its
    // singleton at import time.
    setupFiles: ['./test/integration-env.ts'],
    // Single worker / no isolation: tests share one dynalite instance and a
    // single DynamoDBDocumentClient. Tests use distinct symbols and a
    // beforeEach scrub to stay isolated.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    isolate: false,
  },
})
