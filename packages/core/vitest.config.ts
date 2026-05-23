import { defineConfig, configDefaults } from 'vitest/config'

// Default (unit) config. `test:unit` is plain `vitest run` and would
// otherwise discover the *.integration.test.ts files and try to start
// dynalite. Exclude them here so the unit suite stays pure and offline.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
})
