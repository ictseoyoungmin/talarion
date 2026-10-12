# Roadmap

## TL00 — One Game, Two Runtimes

Web ↔ Android deterministic exported replay, state/visual parity, observed runtime telemetry and machine-readable acceptance. Emulator-backed CI closes TL00 without requiring a physical Android device.

## TL01 — Portability Doctor — CLOSED

Static project, platform API, asset profile and deterministic JSON/HTML reporting implemented in P0–P3; merged via PR #3, #5, #6 and #7.

## TL02 — Performance Budget — CLOSED

Implemented P0–P3 measured-versus-declared runtime authority, strict units, deterministic replay windows and independent observational cohort reports (PR #8–#11). GPU residency, draw calls and physical-device certification remain explicitly unavailable without trusted hardware evidence.

## TL03 — iOS Target — DEFERRED

iOS is outside the currently supported and validated Web/Android scope. P0 macOS/Xcode preflight and P1 Godot Xcode-project ZIP export implementation are merged, preserved and tested for fail-closed behavior, but **real native macOS export, iOS runtime, parity and signing are not certified**. No iOS CI job, Apple developer account, macOS host or paid third-party service is required for baseline development or release. Resume only on an explicit target decision after actual Apple Team/developer identity and macOS/Xcode/Godot export prerequisites are available. [TL03-P0](tl03-p0.md) · [TL03-P1](tl03-p1.md).

## TL04 — Adapter SDK — NEXT

Stabilize the engine/target adapter contract before expanding engine or platform breadth. [TL04-P0](tl04-p0.md) inventories existing Godot and Web/Android boundaries and designs deterministic, agent-friendly capability/conformance interfaces. P1 aligns the reference Godot adapter without replay/evidence regressions; P2 adds focused extension examples and negative fixtures. No additional engine, iOS, hardware certification, or cloud dependency is implied.

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
       Web     Android     iOS (deferred)
```

The roadmap prioritizes contract quality and reproducible evidence before backend breadth.
