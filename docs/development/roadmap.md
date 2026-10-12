# Roadmap

## TL00 — One Game, Two Runtimes

Web ↔ Android deterministic exported replay, state/visual parity, observed runtime telemetry and machine-readable acceptance. Emulator-backed CI closes TL00 without requiring a physical Android device.

## TL01 — Portability Doctor — CLOSED

Static project, platform API, asset profile and deterministic JSON/HTML reporting implemented in P0–P3; merged via PR #3, #5, #6 and #7.

## TL02 — Performance Budget — ACTIVE

Begin with trusted-runner sample provenance (P0), then add declared target profiles and statistically sound regressions for FPS, frame time, memory, draw calls, texture pressure and device constraints. Distinguish synthetic/emulator observations from hardware measurements; do not infer device certification from CI.

## TL03 — iOS Target

Extend the same replay, evidence, and parity contract to iOS without introducing a separate gameplay implementation.

## TL04 — Adapter SDK

Stabilize the engine/backend contract and enable additional integrations to implement Talarion capabilities.

## Release Certification (separate gate)

Actual device compatibility, thermal, lifecycle and device-class FPS/memory claims require the separately reviewed [Release Certification](release-certification.md) process. These are not TL00/feature-development prerequisites.

## Long-term shape

```text
              Talarion
                 |
        +--------+--------+
        |                 |
Portability Doctor   Parity Test
        \                 /
         +------Build-----+
                Graph
         /        |        \
       Web     Android     iOS
```

The roadmap prioritizes contract quality and reproducible evidence before backend breadth.
