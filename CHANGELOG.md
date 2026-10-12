# Changelog

## Unreleased

### Changed

- TL00 foundation merged into `main` after Web/Android emulator, state, visual, telemetry, provenance and 9/9 acceptance checks passed (October 12, 2026). Physical-device certification remains independent.

- TL00 runtime acceptance now requires full exported Web/Android emulator evidence, not physical Android hardware; added machine-verifiable `talarion gate tl00` result and CI check.
- Physical device performance, thermal, compatibility and lifecycle certification moved into a separate optional release gate; emulator FPS is explicitly observational only.
- TL01 Portability Doctor becomes the next development slice after TL00 acceptance.

### Added

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
