# Changelog

## [0.8.0](https://github.com/Token-Buzz/website/compare/v0.7.0...v0.8.0) (2026-05-26)


### 🚀 Features

* **alerts:** end-to-end Alerts feature (M1 Phase 1 data + Phase 4 UI… ([307aa06](https://github.com/Token-Buzz/website/commit/307aa0676f3933f2d30fc47132d4d84a4c1fc3c3))
* **alerts:** end-to-end Alerts feature (M1 Phase 1 data + Phase 4 UI/eval) ([aa9fd61](https://github.com/Token-Buzz/website/commit/aa9fd61db592f0cef1d6cded1e44b99f4944b178))
* **byok:** Phase 7 — provider registry + multi-provider readiness ([e32dcaf](https://github.com/Token-Buzz/website/commit/e32dcaf968fb58d2bffb0bdd4dcce7076449a85d))


### 🐛 Fixes

* **application:** redirect already-signed-in users away from /sign-up ([fc627e1](https://github.com/Token-Buzz/website/commit/fc627e168c4bfdcc1c287e96797c843774eb9f70)), closes [#148](https://github.com/Token-Buzz/website/issues/148)
* changelog navbar links + redirect signed-in users from sign-up ([3345a06](https://github.com/Token-Buzz/website/commit/3345a0680be693be7ef121671f42114a202a1b99))
* **core:** add explicit ./providers export for Turbopack build ([27939d9](https://github.com/Token-Buzz/website/commit/27939d9be7e775c805d65a7f7f09f1850a4422d9))
* **marketing:** make shared Nav links resolve to homepage sections off-home ([7050fed](https://github.com/Token-Buzz/website/commit/7050fedb0fe1cbd0e919c0e48cb6d55566786e46)), closes [#160](https://github.com/Token-Buzz/website/issues/160)


### 📝 Documentation

* mirror full milestone spec into the epic issue, not just a stub ([47b50ab](https://github.com/Token-Buzz/website/commit/47b50ab48c9b300b089693d14c4d2354fc5b3b95))
* mirror full milestone spec into the epic issue, not just a stub ([64e28b2](https://github.com/Token-Buzz/website/commit/64e28b249e2352b86406dd34ad89decf83c61284))
* require a Size on every issue and add size-aware execution stra… ([2cb9862](https://github.com/Token-Buzz/website/commit/2cb9862bd819ff2fc9fe8bb0ec23dc972c43e576))
* require a Size on every issue and add size-aware execution strategy ([911ec27](https://github.com/Token-Buzz/website/commit/911ec27ed16519f285f9f4f75ab974cebe0b3a01))


### 🧰 Maintenance

* generate release notes via Claude Code CLI on subscription token ([4425e8b](https://github.com/Token-Buzz/website/commit/4425e8bfb7c55b09475cd1bad456936b12ff02c8))
* release notes via Claude Code CLI (subscription token, no API key) ([4c99775](https://github.com/Token-Buzz/website/commit/4c99775d5a65bd19282feb2c80814865748f22f4))

## [0.7.0](https://github.com/Token-Buzz/website/compare/v0.6.2...v0.7.0) (2026-05-25)


### 🚀 Features

* AI-written release notes + reliable release creation ([3b1ed47](https://github.com/Token-Buzz/website/commit/3b1ed4787986c4ed98f7fbd54e57aa1cb6278300))
* **byok:** Phase 6 — background-polling opt-in toggle ([#112](https://github.com/Token-Buzz/website/issues/112)) ([f5933f7](https://github.com/Token-Buzz/website/commit/f5933f73a4aa85d4bde24a1df5c1f21ceaac05ea))
* **scripts:** AI-written release notes + reliable release creation ([95ae716](https://github.com/Token-Buzz/website/commit/95ae7167a13926adb718fd1e9af9f82c687510e3))


### 🐛 Fixes

* **byok:** correct twitterapi.io user-info param + response shape ([#112](https://github.com/Token-Buzz/website/issues/112)) ([aed5815](https://github.com/Token-Buzz/website/commit/aed5815081b0b7700da825ce6ea17c99e0e36815))


### 📝 Documentation

* add claude-starter — portable Claude Code config for a Terrafor… ([452e47b](https://github.com/Token-Buzz/website/commit/452e47b86244fcc94922bdaf098b383e29840960))
* add claude-starter — portable Claude Code config for a Terraform repo ([b0f94b7](https://github.com/Token-Buzz/website/commit/b0f94b73756324b31b7f5334c15280db52951cef))
* don't push while a deploy is in flight for the same stage ([6548b37](https://github.com/Token-Buzz/website/commit/6548b377e2eca87aeb2342b2003e9ffe049aa41c))
* end PR summaries with PR / issue / branch links in that order ([6cc1a11](https://github.com/Token-Buzz/website/commit/6cc1a117ed92c62be09b55c1d2875bbef6cf8b07))
* open PRs automatically when changes are ready (no need to ask) ([8ffdc0d](https://github.com/Token-Buzz/website/commit/8ffdc0d25e7dd10976e9ab2e208dec120186946a))


### 🧰 Maintenance

* add [skip deploy] escape hatch to the deploy workflow ([a8c5a46](https://github.com/Token-Buzz/website/commit/a8c5a46c0acd9fa117e597c90245e8da2f048866))
* **byok:** Phase 5 — remove unused project TWITTER_API_KEY secret ([#111](https://github.com/Token-Buzz/website/issues/111)) ([e3a20f2](https://github.com/Token-Buzz/website/commit/e3a20f2d53fd876d5caeaa22461c2d535351a15b))
* **byok:** Phase 5 — remove unused project TWITTER_API_KEY secret ([#111](https://github.com/Token-Buzz/website/issues/111)) ([52afc6c](https://github.com/Token-Buzz/website/commit/52afc6c0ad7378b5f8b8e48b107a1d89d4d45a7e))
* don't cancel production deploys mid-apply ([777f72a](https://github.com/Token-Buzz/website/commit/777f72a883c3ef4f89fbb95db6684b1273795f57))
* never cancel production deploys mid-apply ([e273335](https://github.com/Token-Buzz/website/commit/e273335a0739cff53aa374f6d414efa83b191653))
* release master ([b2b438e](https://github.com/Token-Buzz/website/commit/b2b438e247db8a941171460ba9d457d682d684b0))

## [0.6.2](https://github.com/Token-Buzz/website/compare/v0.6.1...v0.6.2) (2026-05-25)


### 📝 Documentation

* M13 (Token Press Releases) + M14 (Token News & Articles) milestones ([6b3092f](https://github.com/Token-Buzz/website/commit/6b3092ffe8e80b87a305d3019a195b428ec1f23a))


### 🧰 Maintenance

* release master ([2f2b741](https://github.com/Token-Buzz/website/commit/2f2b741eb138dcbc3e471868586578bd9b802cf6))
* skip PR teardown for release-please branches ([3fff980](https://github.com/Token-Buzz/website/commit/3fff9802f28832bc17b1e63a51d7fcc923f5d009))
* skip PR teardown for release-please branches ([c39e356](https://github.com/Token-Buzz/website/commit/c39e3562b6b64030a6296700fb36580f9a9060fb))

## [0.6.1](https://github.com/Token-Buzz/website/compare/v0.6.0...v0.6.1) (2026-05-25)


### 🐛 Fixes

* **application:** consolidate analytics fan-out + surface query error… ([811c318](https://github.com/Token-Buzz/website/commit/811c31876a8e07dab8b376a390bef7693d9fe3bc))


### 🧰 Maintenance

* sync release-please baseline to v0.6.0 ([40a6418](https://github.com/Token-Buzz/website/commit/40a6418b5ba386c4a303861afcc6fccc2b23661d))
* sync release-please baseline to v0.6.0 ([c8b730a](https://github.com/Token-Buzz/website/commit/c8b730a29aeb8a17f6fc2b0de255ce5801e46c01))
