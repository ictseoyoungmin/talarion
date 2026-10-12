# Next Implementation Slice — TL01 Portability Doctor

## Completed foundational slice

- TL00-R1: exported Web ↔ Android deterministic state replay, 15/15 snapshots.
- TL00-R2: three cross-runtime visual checkpoints, global RGB + spatial tile gates, PNG/HTML diff evidence.
- TL00-R3: Web/Android engine-observed FPS/processing/memory, hardware metadata, replay/APK provenance and machine-readable acceptance.
- TL00 acceptance is bound to the entire GitHub CI, not just the fixture-only `npm run verify` output.
- **Separate release gate:** real-device compatibility/performance/thermal/lifecycle claims are tracked by [Release Certification](release-certification.md), not by TL00.

## TL01 objective

Extend static and project-level portability checks without inventing target-specific gameplay forks. Preserve the single canonical game source and headless reproducibility.

### Candidate vertical-slice order

1. **TL01-P0 — CLOSED:** portable API classes, severity, deterministic locations and positive/negative fixtures, accepted in PR #3. See [P0 contract](tl01-p0.md).
2. **TL01-P1 — CLOSED:** target-only APIs, lifecycle/input assumptions and adapter boundaries, merged in PR #5. [P1 contract](tl01-p1.md).
3. **TL01-P2 — CLOSED:** inspected source PNG/JPEG/WebP headers, profiles and explicit unknowns in PR #6. [P2 contract](tl01-p2.md).
4. **TL01-P3 — candidate:** deterministic, actionable JSON/HTML Doctor reports, stable source-rule finding IDs, CLI export and CI artifacts. [P3 contract](tl01-p3.md). Close only after exact-head CI and merge.

## After TL01

TL02 Performance Budget is the next engineering milestone, with separate measured versus declared performance evidence. Keep physical-device Release Certification independent; retain visual capture race QA issue #4 as OPEN until root-caused.

## Quality gates

- No fixtures or stubbed evidence can be misreported as exported runtime proof.
- The existing TL00 replay, visual and performance evidence gates must remain green.
- No real-device benchmark claim based on emulator measurements.
- Any major refactor of cross-runtime evidence invalidates previous TL00 closure until rerun.
