# Next Implementation Slice — TL03 iOS Target

## Completed

- **TL00 — CLOSED:** exported Godot Web / Android parity 15/15 snapshots, 3/3 spatial visual checkpoints, 9/9 acceptance.
- **TL01 — CLOSED:** Portability Doctor source diagnostics and deterministic reports, PR #3/#5/#6/#7.
- **TL02 — CLOSED:** Performance evidence and budgets, P0–P3 merged PR #8/#9/#10/#11. Cross-run and single-run reports make no false physical-device claims.

## TL03 plan

1. **TL03-P0 — CLOSED:** host, platform, toolchain and iOS identity preflight. [Contract](tl03-p0.md).
2. **TL03-P1 — IMPLEMENTATION:** macOS-only Godot iOS ZIP export adapter and reproducible archive/replay provenance. [Contract](tl03-p1.md). Native macOS export evidence remains pending.
3. **TL03-P2:** iOS simulator/physical runtime replay evidence, screenshots and verified target identity.
4. **TL03-P3:** cross-target replay/visual comparison and distinct release certification handoff.

Maintain the same canonical Godot source and replay data. Linux CI never claims iOS export or runtime certification.

## Separate open gates

- [Screenshot race QA #4](https://github.com/ictseoyoungmin/talarion/issues/4) remains OPEN. No relaxation of spatial visual checks.
- [Release Certification](release-certification.md) remains independent for real-device compatibility/FPS/thermals.
