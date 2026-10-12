# Roadmap

## TL00 — One Game, Two Runtimes

Web ↔ Android deterministic exported replay, state/visual parity, observed runtime telemetry and machine-readable acceptance. Emulator-backed CI closes TL00 without requiring a physical Android device.

## TL01 — Portability Doctor — CLOSED

Static project, platform API, asset profile and deterministic JSON/HTML reporting implemented in P0–P3; merged via PR #3, #5, #6 and #7.

## TL02 — Performance Budget — CLOSED

Implemented P0–P3 measured-versus-declared runtime authority, strict units, deterministic replay windows and independent observational cohort reports (PR #8–#11). GPU residency, draw calls and physical-device certification remain explicitly unavailable without trusted hardware evidence.

## TL03 — iOS Target — ACTIVE

Extend the same replay, evidence, and parity contract to iOS without introducing a separate gameplay implementation. P0 preflight merged. P1 adds a real macOS-only Godot iOS Xcode project ZIP export path with SHA-256 evidence; Linux CI remains strictly blocked. Native macOS export is not yet independently observed. [TL03-P0](tl03-p0.md) · [TL03-P1](tl03-p1.md).

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
