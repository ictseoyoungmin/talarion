# ADR-003 — Game Execution Semantics and Optional Portable IR

Status: **Accepted (design only)**  
Date: 2026-10-13

## Decision

A common scene graph or glTF scene cannot guarantee portable gameplay. First define the **execution semantics** of each portable operation, then encode proven operations in a versioned IR. The portable subset is opt-in; most runtime-preserving games keep their existing implementation.

A game has **one authoritative gameplay state owner per session**:
- For runtime-preserving paths, original game code/engine remains authoritative; Talarion only delivers inputs and records evidence.
- For an opt-in portable-core path, a separately defined portable simulation core owns authoritative state and the rendering hosts reflect its outputs.
- Never allow a Talarion shadow simulation and host engine physics to both update canonical transforms. Presentation interpolation may use temporary, non-authoritative values.

## Initial semantic contract to be specified before portable operators

1. **Clock:** exact tick index/tick rate; distinguish simulation tick, wall time, render frame and async completion. Define pause, resume, skipped ticks and late input policy. Fixed tick alone does not ensure cross-engine determinism.
2. **Input/events:** semantic action names, typed payloads, tick association and stable ordering/tie-breaking. Raw touch/keyboard/gamepad belongs to device adapters; do not assume identical physical input.
3. **State identity:** stable entity IDs, fields, units, coordinate handedness/up axis, angle units, normalization/precision and schema version. Explicit serialization, migration and absent-vs-null treatment.
4. **Randomness:** seeded RNG identity, consumption order and boundaries. Host-specific RNG behavior is nonportable unless explicitly constrained.
5. **Physics:** collision ownership, stepping order, contact material semantics, integrator and authoritative body state. No blanket bitwise determinism guarantee across Godot and browser physics engines; document numeric tolerances only for specified observable domains.
6. **Animation/events:** root motion ownership, blend transition timing, animation event order and named checkpoint timing. Asset animation parity does not establish gameplay parity.
7. **Async/runtime APIs:** storage, networking, asset loading, audio and lifecycle may be nondeterministic; record or mock inputs for replay and report unverified dependencies.

## Portable IR design constraints

- A versioned, **bounded operator set**, typed attributes, capability requirements and a deterministic validation failure for unsupported operations.
- Semantics are normative and tested with two independent implementations **before** a cross-engine portability claim.
- Represent portable source world/events, not arbitrary imperative host code or GPU shader programs. Reuse glTF/GLB for supported 3D asset interchange and keep engine-specific shaders or physics as explicit extensions.
- Unknown, host-only or lossy operations require a declared fallback and explicit behavioral/visual tradeoff; never silently drop.
- No common IR requirement for same-runtime Web -> WebView packaging, and no implicit promise that arbitrary JS can be compiled into Godot scripts.
- A future Wasm execution core may share logic, but Wasm by itself does not standardize engine behavior, physics, GPU APIs or lifecycle.

## Evidence and equivalence

- **Same-runtime:** claim only what actual Web and Android runs observe; do not infer pixel identity from shared JS.
- **Shared-runtime:** compare the same game semantics on distinct hosts with declared tolerances.
- **Cross-engine:** independent operators/physics implementations require conformance fixtures and replay comparisons; report unsupported or partial when evidence is missing.
- Compare gameplay-authoritative state, events and timing separately from screenshots and rendering quality. Per-game acceptance thresholds must be explicit and reviewed; a sample's 15 states/3 screenshots do not transfer to another game.

## First falsification experiment

Implement a very small independent interactive game in a Web engine; validate authoritative state and named capture checkpoints in browser and Android WebView. Separately experiment with just `spawn`, `set_transform`, semantic `move`, and `interact` in two engines to see whether an IR adds value without rewriting gameplay. Do not promote these into a published IR until semantics and cross-provider tests pass.

References: [ADR-002](002-source-runtime-artifact-separation.md), [ADR-004](004-evidence-and-android-release-authority.md).
