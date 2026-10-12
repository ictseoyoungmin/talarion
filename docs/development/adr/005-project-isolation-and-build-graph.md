# ADR-005 — External Projects, Isolation and Build Graph

Status: **Accepted (design only)**  
Date: 2026-10-13

## Decision

A game is an **independently owned project**, not a folder forcibly copied into the Talarion repository. Planning/inspection must work non-destructively; build/test actions must have explicit effects and scoped paths. Multi-target builds require a dependency graph with measurable provenance instead of implicit ordering and shared output folders.

## Project boundaries

- Read-only project discovery accepts a clearly supplied external root. Resolve real paths, prevent symlink traversal for protected operations and validate trust boundaries before any mutation.
- Keep the game source, engine project, Talarion configuration, generated builds, per-run evidence and cached dependencies as separately identified inputs/outputs.
- Do not silently inject `talarion_bridge.gd`, patch `project.godot`, replace Android manifest/package identifiers or modify user scenes. A proposed patch is reviewable; opt-in apply requires a backup/rollback strategy and path containment.
- Replay delivery goes to a staging workspace or generated build tree where possible. Never overwrite/remove an existing user file or prune unrelated project directories in an implicit `build` cleanup.
- Inspect third-party manifests or packages as data; no dynamic imports, build scripts or plugin hooks during preflight. Execution requires explicit trust, a sandbox/process boundary and clearly declared filesystem/network permissions.
- Cache keys and reports must include toolchain, dependency lock/version, source/replay hashes and target profile. If any input is unknown, cache validity and reproducibility cannot be claimed.

## Target graph (planned, not implemented)

~~~text
project discovery (read-only)
          |
source/capability inspection
          |
      dependency resolution
          |
  +-------+---------------------+
  |                             |
Web bundle                    Android builder
  |                        +-----+-------+
browser runtime            debug APK   release AAB
  |                           |          |
browser evidence          emulator      bundle inspection
  |                        evidence      policy/signing gate
  +------------+--------------+
               |
      game-specific parity report
~~~

Each node has a typed artifact contract, version, inputs, outputs, deterministic identity, declared mutability and failure authority. No node may claim success from another game's fixture or a stale run. Concurrency must avoid shared artifacts directories; retries may not alter committed sources or previously sealed evidence. Failure/unknown states are explicit.

## Existing baseline and migration

Today `loadConfig` locates a single `talarion.config.json` upward from working directory; `verify` compares bundled Ruins Lite state fixtures; runners write common `artifacts/run/web|android`; Godot replay staging edits a configured project subtree. These are **known reference-only boundaries**, not evidence of safe arbitrary-project adoption.

Migration order:
1. External project/config discovery with read-only isolation and negative path/symlink tests.
2. Per-project/per-run artifact namespaces, immutable provenance, guarded replay staging and safe cleanup.
3. Web-native dev/QA runner and runtime-preserving Android APK builder.
4. Release AAB branch and independent signing/Play gate; explicit build graph.
5. Optional portable-subset/cross-engine branch only after concrete evidence.

The old Godot config and all TL00 15/15 states, strict 3/3 screenshots at the 2% tile limit and TL00 9/9 acceptance must remain functional without schema migration until a separately reviewed compatibility change. Any dependency lockfile change must be generated using real verified dependency resolution; never fabricate offline lock metadata.

## Acceptance tests for future implementation

- Existing external source tree is byte-identical before/after static inspect and build unless explicit patch consent was given.
- A symlink/path escape, conflicting staged file, untrusted hook or malicious config path fails closed without filesystem damage.
- Two projects can run concurrently without replay, artifact, environment or report cross-contamination.
- Runtime and release evidence identify the exact build and replay; changed source/assets/toolchain invalidates stale gate reuse.
- No regression in current Godot Web/Android exported CI and acceptance.

References: [ADR-002](002-source-runtime-artifact-separation.md), [ADR-004](004-evidence-and-android-release-authority.md).
