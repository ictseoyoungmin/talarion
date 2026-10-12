# Next Implementation Slice — TL02 Performance Budget

## Completed

- **TL00 — CLOSED:** exported Godot Web ↔ Android parity, 15/15 replay snapshots, 3/3 spatial checkpoints and 9/9 evidence acceptance.
- **TL01 — CLOSED:** P0 diagnostic catalog (PR #3), P1 platform boundaries (PR #5), P2 source asset budgets (PR #6), P3 reproducible JSON/HTML Doctor reports (PR #7).
- Android physical-device certification is a separate optional release gate, not a development prerequisite.

## TL02 scope

Distinguish declared goals from engine-measured Web/Android telemetry with reproducible evidence authority, then implement target-specific budgets and statistically defensible regressions. Do not grade emulator observations as certified real-device performance.

### Vertical-slice plan

1. **TL02-P0 — CLOSED:** raw sample recomputation, provenance, target identity, evidence authority. Merged PR #8. [Contract](tl02-p0.md).
2. **TL02-P1 — CLOSED:** fixed-unit metric vocabulary, strict target profiles, explicit budget coverage with no automatic PASS, merged PR #9. [Contract](tl02-p1.md).
3. **TL02-P2 — CLOSED:** canonical warmup and sampling, verified distributions and conservative regression helper (PR #10). [Contract](tl02-p2.md).
4. **TL02-P3 — candidate:** evidence-bound independent cohorts, JSON/HTML reports, observational regression decisions and noncertifying single-run CI artifact. [Contract](tl02-p3.md). Close after exact-head and post-merge CI.

## Invariants

- Preserve TL00 exported runtime 15/15, 3/3 and 9/9 acceptance gates and TL01 source-only diagnostics.
- No physical-device FPS, GPU residency or draw-call claims from emulator-only telemetry.
- The [QA screenshot capture issue #4](https://github.com/ictseoyoungmin/talarion/issues/4) stays OPEN until evidence-based correction without relaxing the visual gate.

## After TL02

Proceed to TL03 Web ↔ Android target adapters and lifecycle portability, once P3 passes unchanged TL00 acceptance. Physical-device release certification and QA issue #4 remain separate.
