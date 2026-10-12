# Next Implementation Slice — TL04 Adapter SDK

## Stable foundation

- **TL00 — CLOSED:** exported Godot Web/Android replay parity 15/15 states, 3/3 strict visual checkpoints, TL00 9/9 acceptance.
- **TL01 — CLOSED:** Portability Doctor and deterministic source diagnostics/reports.
- **TL02 — CLOSED:** measured-versus-declared performance evidence authority, review reports and reproducible provenance.
- **TL03 — DEFERRED:** iOS preflight and export adapter implementation are preserved in `main`; native Xcode export/runtime evidence is not observed. iOS is **not** a blocking release, CI, or TL04 dependency. See [TL03-P1](tl03-p1.md).

## Active next work: TL04

The first public support boundary remains **Godot → Web/Android**. Stabilize the adapter contract before adding new engines or targets.

1. **TL04-P0 — implementation under review:** versioned Godot manifest, source-only capability inspection, fail-closed tests and static verify integration. Closure requires exact-head exported regression CI. [Contract](tl04-p0.md).
2. **TL04-P1:** migrate the existing Godot integration to the stable contract without changing game logic, canonical replay or exported Web/Android acceptance.
3. **TL04-P2:** publish compact reference adapter fixtures and extension guidance; never imply a second engine/target is supported without observed execution.

## Non-negotiable gates

- Preserve the Web/Android 15/15 replay state, 3/3 strict spatial visual and 9/9 TL00 acceptance.
- No baseline dependency on Apple developer credentials, macOS, physical devices or paid cloud services.
- Declared capabilities are **not** proof of engine/runtime/device certification; unsupported, unknown and unverified evidence remain distinct.
- Keep [QA screenshot race issue #4](https://github.com/ictseoyoungmin/talarion/issues/4) separate until raw artifacts have been reviewed. Maintain its 2% spatial visual threshold.
- iOS can resume only by an explicit scope decision with real Apple identity/macOS export prerequisites; resume from native Xcode ZIP provenance rather than redoing P0/P1 source work.

## Release certification

[Hardware certification](release-certification.md) stays separate from feature development. No emulator performance measurement becomes a physical-device guarantee.
