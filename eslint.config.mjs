// Root ESLint config — scopes linting to the E2E harness (playwright.config.ts
// and e2e/**). Each workspace under packages/* has its own eslint config and is
// linted via `npm run lint --workspaces`; this root config only covers files
// that live outside any workspace.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'packages/**',
      '.sst/**',
      '.next/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['playwright.config.ts', 'e2e/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
)
