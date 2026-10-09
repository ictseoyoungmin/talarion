# Next Implementation Slice — TL00-R3 Device Performance & Physical Android QA

## Objective

Extend the already verified TL00 Web ↔ Android state and visual parity workflow with observed performance evidence, then require a reproducible physical-device gate before closing TL00.

## Baseline

- TL00-R1 CLOSED: 600-tick replay, 15/15 state snapshots matched.
- TL00-R2 CLOSED: [CI run #37957078215](https://github.com/ictseoyoungmin/talarion/actions/runs/37957078215); 3/3 checkpoints, 99.9759% mean global similarity; 16×9 spatial tile error at most 1.151% (<2% configured bound).
- Emulator: Android 11 / API 30 AOSP, ANGLE-backed SwiftShader (`-gpu swangle`). This is **emulated**, not physical-device QA.

## R3 current implementation

- [x] Godot emits `TALARION_PERF` at fixed replay intervals separately from state events.
- [x] Web and Android runners collect `performance.jsonl` and `talarion.performance/v1` summaries.
- [x] Sample validation rejects absent, duplicate or malformed telemetry.
- [x] Summaries record median and P10 FPS, P95 process and physics timing, and peak static memory.
- [x] Target FPS is included as a declared budget, not falsely declared compliant.
- [ ] Performance HTML report validated across both runtimes in CI.
- [ ] Android hardware fingerprint, API/renderer/GPU metadata captured and bound to evidence.
- [ ] Physical Android device QA: exported APK installed, same replay and screenshots verified.
- [ ] Hardware-specific FPS, memory, thermal and lifecycle gates validated.
- [ ] Report and reproducible verification artifacts reviewed before TL00 closure.

## Evidence policy

Emulator performance data is **observational only**. The shared CI virtual GPU can be drastically slower than physical hardware; neither an emulator PASS nor target FPS configuration proves mobile performance. Do not silently remove, relax or conflate state, visual or performance failures.

## Physical device procedure

1. Connect a real Android device with Developer Options and USB debugging enabled, authorize ADB, and select it with `ANDROID_SERIAL` if needed.
2. Run `node bin/talarion.mjs test android --json` using the same checked-in replay.
3. Run the Web target and `node bin/talarion.mjs compare ...`, followed by `visual compare` and `report`.
4. Preserve APK/source commit hash, ADB device ID and build fingerprint, screenshots, performance JSONL, summary, and comparison artifacts.
5. Review performance thresholds per actual device class. Do not close TL00 without this physical evidence.

## R3 closure

A physical Android build must pass gameplay state, named screenshots and visual parity. Performance must be independently measured and evaluated against a recorded device-specific budget; Web/Android emulator CI remains a prerequisite, not a substitute. Device metadata and evidence artifacts must be sufficient for an external maintainer to reproduce results.
