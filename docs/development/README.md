# Development Documentation

This directory contains the engineering specification for Talarion.

## Documents

- [Architecture](architecture.md) — product boundary, canonical source model, adapters, and build graph.
- [Portability Contract](portability-contract.md) — platform boundaries, doctor rule classes, replay/state contracts.
- [QA and Parity](qa-parity.md) — deterministic replay, state/visual/performance comparison, and device QA cadence.
- [Runtime Runners](runtime-runners.md) — common evidence contract for Web and Android runners.
- [Engine Strategy](engine-strategy.md) — Godot-first backend scope and future adapter model.
- [TL00](tl00.md) — emulator-backed Web/Android automated-acceptance contract and closure criteria.
- [Release Certification](release-certification.md) — optional separate physical-device hardware/compatibility gate.
- [TL01-P0](tl01-p0.md) — Portability Doctor rule classes, findings and fixture contract.
- [TL01-P1](tl01-p1.md) — direct target APIs, lifecycle/input event signatures and adapter ownership checks.
- [TL01-P2](tl01-p2.md) — static image metadata, texture limits and unknowns.
- [TL01-P3](tl01-p3.md) — deterministic machine-readable Doctor findings, JSON/HTML export and CLI report.
- [TL02-P0](tl02-p0.md) — observed-versus-declared performance evidence authority, integrity controls and device classification.
- [TL02-P1](tl02-p1.md) — strict unit vocabulary, source metric coverage and no false budget pass.
- [TL02-P2](tl02-p2.md) — canonical replay sample windows, variation summaries and conservative observational regression.
- [TL02-P3](tl02-p3.md) — verified multi-run cohort manifests, offline performance review and noncertifying CI decisions.
- [TL03-P0](tl03-p0.md) — deferred macOS/Xcode/SDK iOS preflight and unverified export/runtime boundary.
- [TL03-P1](tl03-p1.md) — retained experimental iOS Xcode ZIP export and provenance code; native macOS evidence uncollected.
- [TL04-P0](tl04-p0.md) — versioned Godot manifest, static adapter CLI inspection and negative conformance contract.
- [TL04-P1](tl04-p1.md) — actual Godot build/runner dispatch behind immutable reference bindings and fail-closed source authority.
- [TL04-P2](tl04-p2.md) — read-only candidate manifest verification, negative fixtures and contributor guidance; TL04 P0–P2 completed.
- [TL05-P0](tl05-p0.md) — independent Godot project integration prerequisite inspection, sample-coupling audit and readiness boundaries.
- [Next Slice](next-slice.md) — completed TL04 baseline and proposed next independent-project adoption proof.
- [Roadmap](roadmap.md) — TL00 through adapter ecosystem milestones.
- [OSS Strategy](oss-strategy.md) — repository positioning, local-first requirements, and contributor-facing product constraints.
