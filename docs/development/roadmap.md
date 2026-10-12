# Roadmap

## TL00 — One Game, Two Runtimes

Web ↔ Android deterministic exported replay, state/visual parity, observed runtime telemetry and machine-readable acceptance. Emulator-backed CI closes TL00 without requiring a physical Android device.

## TL01 — Portability Doctor — CLOSED

Static project, platform API, asset profile and deterministic JSON/HTML reporting implemented in P0–P3; merged via PR #3, #5, #6 and #7.

## TL02 — Performance Budget — CLOSED

Implemented P0–P3 measured-versus-declared runtime authority, strict units, deterministic replay windows and independent observational cohort reports (PR #8–#11). GPU residency, draw calls and physical-device certification remain explicitly unavailable without trusted hardware evidence.

## TL03 — iOS Target — DEFERRED

iOS is outside the currently supported and validated Web/Android scope. P0 macOS/Xcode preflight and P1 Godot Xcode-project ZIP export implementation are merged, preserved and tested for fail-closed behavior, but **real native macOS export, iOS runtime, parity and signing are not certified**. No iOS CI job, Apple developer account, macOS host or paid third-party service is required for baseline development or release. Resume only on an explicit target decision after actual Apple Team/developer identity and macOS/Xcode/Godot export prerequisites are available. [TL03-P0](tl03-p0.md) · [TL03-P1](tl03-p1.md).

## TL04 — Adapter SDK — CLOSED

P0 [versioned reference manifest and source-only inspection](tl04-p0.md), P1 [allowlisted Godot Web/Android execution binding](tl04-p1.md), and P2 [candidate JSON conformance and extension guidance](tl04-p2.md) merged in PR #17–#19. Every PR passed actual exported Web/Android runtime replay and the unchanged 15/15 state, 3/3 strict spatial visual and TL00 9/9 acceptance. SDK source binding cannot self-certify a device, engine runtime or unsupported platform.

## TL05 — External Godot Project Adoption — ACTIVE (P0 CLOSED)

Demonstrate that an independent Godot game, beyond Ruins Lite, can use the same export/replay/evidence contract without changes to Talarion core. P0 source-only adoption preflight and Ruins Lite coupling inventory merged via PR #21 (CI 6/6; no independent-game runtime certification). P1 must prove a genuinely different Godot game on exported Web/Android with independent replay/state/visual provenance and no Talarion-core rewrite. P2 generalization must follow proven integration. [Next implementation slice](next-slice.md). No additional engine or iOS work is assumed.

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
