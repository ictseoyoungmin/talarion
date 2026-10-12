# Changelog

## Unreleased

### Changed

- TL00 foundation merged into `main` after Web/Android emulator, state, visual, telemetry, provenance and 9/9 acceptance checks passed (October 12, 2026). Physical-device certification remains independent.

- TL00 runtime acceptance now requires full exported Web/Android emulator evidence, not physical Android hardware; added machine-verifiable `talarion gate tl00` result and CI check.
- Physical device performance, thermal, compatibility and lifecycle certification moved into a separate optional release gate; emulator FPS is explicitly observational only.
- TL01 Portability Doctor becomes the next development slice after TL00 acceptance.

### Added

- TL03-P0 iOS capability preflight `talarion ios preflight <out.json>`, with conservative macOS/Xcode/iOS SDK, bundle/team identity, preset and Simulator Compatibility-renderer checks; Linux explicitly BLOCKED rather than fabricated export PASS.
- Versioned `talarion.ios-preflight/v1` diagnostics and Node 24 CI artifact. Export templates/signing and simulator/physical runtime remain UNVERIFIED; real export begins TL03-P1.

- TL02-P3 source-verified multi-run performance cohort reviews, explicit observational budget/relative-regression states, and deterministic standalone escaped JSON/HTML reports.
- `talarion budget report current <authority> <output-dir>` CI artifact reports only evidence completeness; `budget report <manifest> <output-dir>` processes unique SHA-256-pinned independent cohorts and rejects duplicated artifacts, cross-environment comparisons and missing provenance.
- Strict negative fixtures for observed degradation, missing runs, sample reuse, unsafe paths, user HTML strings and byte-repeatable reports. Physical hardware/target FPS certification always remains separate.

- TL02-P2 replay-anchored warmup and exact-tick performance windows with fail-closed incomplete/invalid observations and descriptive FPS/process/memory distributions (no target-FPS verdict).
- Noise-aware observational regression helper requiring three independent complete runs per cohort, identical replay/host class/profile and explicit degradation thresholds; inconclusive/noisy/insufficient results never produce false PASS.
- CI asserts complete P2 windows for both actual exported Web and Android runs, while preserving TL00 visual/state parity and the physical-device certification boundary.

- TL02-P1 fixed metric units and target profile checks: FPS, process P95 milliseconds, peak process memory bytes and unobserved draw-call counts, with optional validated explicit `performanceUnits`.
- `talarion.budget-coverage/v1` per-target coverage, `PA07` / `PA08` validation and fail-closed incorrect/missing profile handling. No automatic FPS/device performance PASS; evidence comparability is not compliance.
- Regression tests and exported-runner CI assertions for unobserved metrics, invalid units and always-ungraded budgets.

- TL02-P0 runtime performance evidence authority: recompute raw Web/Android engine JSONL telemetry, compare runner summaries and replay/APK provenance, and distinguish headless Web, Android emulator and unreviewed physical hardware classes.
- `talarion budget authority <web-dir> <android-dir> <out.json>` exports versioned machine-readable checks and preserves a `not-evaluated` budget decision and `hardwareCertified: false` evidence scope.
- CI recomputes the performance authority result from downloaded actual runtime artifacts after TL00 parity acceptance; tests reject mismatched summaries, tampered replays and incomplete data.

- TL01-P3 portable Doctor report schema with deterministic per-finding identifiers and actionable severity/target/remediation summaries, while preserving `talarion.doctor/v1`.
- `talarion doctor report <output-dir>` produces offline escaped HTML and byte-reproducible JSON, with safe in-repository output paths and nonzero exit status on error-level findings.
- Node CI publishes Doctor report artifacts; tests cover deterministic ordering, missing/invalid target states, HTML escaping, repeat exports, symlink escape attempts and fail-closed report exit semantics.

- TL01-P2 deterministic PNG/JPEG/WebP header inspection and per-target static textureMax checks; unsupported/corrupt source observations are explicit UNKNOWN or diagnostic warnings.
- Source-only assetBudget output separates declared FPS/drawcalls from measured hardware results; profile correctness is a distinct validation gate.

- TL01-P1 static diagnostics for Web/Android-native bridges, browser storage, audio, lifecycle events, keyboard events, Godot subprocesses and physical-key polling.
- Optional target adapter declaration verification with safe repository-relative paths, target ownership and wrong-target API auditing; general action-map advice is not mistaken for a missing adapter.
- Positive/negative tests for direct platform APIs, literal event names and invalid/missing adapter files.

- TL01-P0 stable Portability Doctor catalog (talarion.doctor/v1) with capability/target/severity/remediation metadata, deterministic source coordinates and warning/error contract.
- Fixture-backed detection tests that ignore comments, strings and generated .godot content, plus bounded lexical-scanner limitations.

- TL00-R2 real Android/Web spatial visual parity closed: 16×9 regional tile gate, stabilized screenshots and action-state evidence
- TL00-R3 observational FPS/frame-time/memory telemetry in both runtime runners and machine-readable evidence summaries
- Observed performance in the optional HTML parity report (not a physical-device pass)


- TL00-R2 center-crop screenshot normalization and pixel-based visual comparison
- per-checkpoint Web/Android/diff PNG evidence and JSON manifest
- HTML visual QA board and CI visual parity gate
- regression tests for missing, stale, and blank visual checkpoints

### Fixed

- screenshot checkpoint capture now uses a finalized replay tick and stable hold
- asymmetric missing state vectors or health no longer silently pass parity


- initial CLI and configuration contract
- Godot Web/Android build adapter
- baseline portability doctor
- replay v1 validator
- state snapshot comparison with tolerances
- HTML parity report generation
- runtime runner result contract
- minimal Godot sample project
- Node 20/22/24 verification workflow
- canonical replay staging for exported runtimes
- Godot `TalarionBridge` fixed-tick semantic replay
- named capture checkpoint signals
- runtime contract and replay staging tests
- shared Web/Android runtime evidence protocol parser
- Playwright Web runtime runner
- ADB Android runtime runner
- `talarion test web|android` orchestration
- Godot Web runtime CI harness with uploaded runtime evidence
