# Next Implementation Slice — External Godot Project Adoption (Proposed TL05)

## Accepted foundation

- **TL00 — CLOSED:** actual exported Godot Web/Android replay state 15/15, strict visual 3/3 and acceptance 9/9.
- **TL01 — CLOSED:** portable-source Doctor and deterministic reports.
- **TL02 — CLOSED:** observational performance evidence authority and cohort reporting, without hardware self-certification.
- **TL03 — DEFERRED:** experimental iOS preflight/export code is retained, but unverified native macOS/Xcode/iOS targets are excluded from all active acceptance criteria.
- **TL04 — CLOSED:** [P0](tl04-p0.md) versioned adapter manifest and source-only inspector (PR #17); [P1](tl04-p1.md) explicitly allowlisted Godot Web/Android build/runner binding (PR #18); [P2](tl04-p2.md) read-only candidate manifest conformance, source provenance, negative fixtures and extension guide (PR #19). Each PR head passed Node 20/22/24, real exported Web and Android replay, 15/15 state, 3/3 strict visual and TL00 9/9.

## Next bottleneck: portability beyond the single sample

The present proof uses the canonical `examples/ruins-lite` reference project. A stable manifest does not yet demonstrate that an **independent Godot project** can be onboarded without editing Talarion internals. Avoid adding a second game engine or cloud service until that gap is addressed.

**Proposed TL05 — External Godot Project Adoption** (not implemented or certified):

1. **P0 — Sample-coupling inventory:** trace project-specific paths and assumptions in runtime contract checks, `verify`, capture/replay staging, runners, target presets and parity CLI. Specify opt-in, non-destructive installation/validation for an independent project.
2. **P1 — Independent Godot vertical slice:** onboard a second deliberately different small Godot game without editing core Talarion engine or runner code. Prove actual Web/Android exported replay and evidence.
3. **P2 — Reproducible onboarding and agent diagnostics:** generalize only demonstrated integration boundaries, publish an executable project-adoption example and focused failures, and maintain TL00 acceptance regression.

## Immutable boundaries

- Preserve Web/Android 15/15 state, 3/3 strict spatial visual threshold 2% and TL00 9/9 for the canonical sample.
- Capability declarations and source binding are **not** runtime or physical hardware proof.
- iOS stays deferred. Do not require Apple credentials, macOS, paid cloud services, new engine backends or physical-device verification for infrastructure CI.
- Keep [QA screenshot race issue #4](https://github.com/ictseoyoungmin/talarion/issues/4) separately open until raw before/after image diff review.
- Dependency lockfile generation and `npm ci` reproducibility remain a separate verified maintenance slice; do not fabricate an offline lockfile.
