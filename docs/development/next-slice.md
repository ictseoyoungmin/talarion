# Next Slice — Android Touch & Lifecycle QA (WF02-P1)

## Accepted baseline

- **TL00–TL02 CLOSED:** Godot Ruins Lite exported Web/Android runner proof; state 15/15, strict visual 3/3 with declared 2% tile-error limit, TL00 acceptance 9/9; static Doctor and observational performance evidence.
- **TL03 DEFERRED:** experimental iOS code remains, with no native iOS runtime or signing certification.
- **TL04 CLOSED:** Godot adapter manifest, explicit dispatch, read-only candidate conformance.
- **TL05-P0 CLOSED:** non-destructive *read-only* in-repository Godot preflight and sample coupling inventory, PR #21; does not demonstrate independent gameplay.
- **TL05-P1 / P2 RESEQUENCED — NOT CLOSED:** independent second-Godot-game adoption proof remains valid work but is not the next product bottleneck; do not claim completed or delete its history.

## Design gate — accepted ADRs

[ADR-001–005](adr/README.md) specify the forward architecture: source-owned Web-first development; source/runtime/artifact independence; single game-state authority and optional limited IR; separate build/runtime/parity/store proof; isolated external projects and provenance-aware graph.

**ADR acceptance is not implementation evidence.** The existing Godot `talarion.config.json` stays v1. A separate `web-native dev/test` runner now exists for one Three.js reference project; no general-purpose Babylon.js adapter, Play release AAB or cross-engine IR exists. The original Signal Garden Web-native game now has a constrained offline Android WebView Debug APK builder and emulator-tested replay/parity.

## New prioritized implementation slices

### WF01 — Browser-native playable reference and QA (P0 CLOSED)

- **WF01-P0 CLOSED:** original Three.js Signal Garden 3D game with an independent source manifest, interactive browser run and actual Playwright WebGL2 evidence, without Godot conversion. PR #24, exact-head CI #38285851400 and post-merge main CI #38286257646 both 7/7 PASS. [Implemented game & QA](wf01-p0.md).
- Integrate minimal adapter/runtime evidence: developer-owned source, semantic replay, authoritative game state, named screenshots, performance capture and explicit runtime capabilities. Do not make existing `talarion test web` silently accept unknown engines.
- Persist project-source/build/replay/runtime hashes and separate run outputs. Negative test untrusted projects, missing capabilities and invalid evidence.
- **Exit:** executable original browser game and independent runtime evidence **from that game**, plus unchanged Godot exported Web/Android CI and TL00 QA.

### WF02 — Runtime-preserving Android Debug APK (P0 CLOSED; P1 NEXT)

- **WF02-P0 CLOSED:** independently built/installable offline Android WebView Debug APK hosting exactly the same Three.js source. Browser and emulator Replay each supply 10 authoritative snapshots, 3 PNG checkpoints, exact source/vendor/replay hashes and 3/3 victory HUD image assertions. Browser↔WebView `WP001–WP007` PASS, verified on PR #26 exact head CI #38293231318, after QA #4 mitigation PR #27 exact head CI #38297356791 and main CI #38297831598, each 8/8 PASS. [Implementation contract](wf02-p0.md).
- **WF02-P1 NEXT — interactive touch and lifecycle QA:** install the already-built APK in an emulator, exercise real touch controls, HOME/resume and storage/rotation/foreground behavior, and capture independent before/after screenshots and observed gameplay state. The successful automated replay is **not** evidence that manual touch or lifecycle transitions are verified.
- **P1 exit:** real installed app interaction/lifecycle evidence, source/build provenance and explicit limits, without altering or weakening the existing WF02-P0 and legacy Godot runtime/parity gates. No physical-device certification.

### WF03 — Google Play Release AAB preflight

- Generate an isolated **release AAB** for the same Web-native game and independently validate package structure, signing/upload-key custody, package/version, effective target/API policies, 64-bit ABI where applicable, device extraction/install via bundle tooling, permissions and store readiness.
- Prefer current official policy at gate execution; version the policy snapshot. No embedded keys, no auto-publishing, no inferred Play approval.
- **Exit:** independently inspectable signed release AAB and a release-preflight report distinct from build/runtime pass; publication unverified until Play confirms.

### WF04 — Portable-subset feasibility (research, optional after WF01–03)

- Specify a tiny operator set only after behavior semantics are normative. Test the same gameplay in Web-native and a Godot implementation; compare source/state/event/visual evidence without assuming physics equivalence.
- **Exit:** either measured portable-conformance proof or an explicit limitation/rejection of the IR hypothesis. No general Three.js -> Godot conversion claim.

## Execution and scope guards

1. **Do not add code to implementation simply to satisfy accepted ADRs.** Deliver one visible, tested slice at a time; do not weaken Godot reference CI.
2. Keep TL05-P1 in the backlog rather than deleting it or falsely marking it complete; reassess its priority against WF01–03.
3. Fail closed for cross-project source mutation, symlink/staging collisions, malicious plugins, stale provenance and unsupported required capabilities.
4. QA issue [#4](https://github.com/ictseoyoungmin/talarion/issues/4) is mitigated by PR #27 with raw before/after review, explicit Godot Android immersive mode and fail-closed OS status-bar PNG detection; it **remains open for multi-run stability monitoring**. Do not weaken the 2% max-tile visual gate. Lockfile generation still needs real dependency resolution, not a fabricated offline lock.
5. Actual device-class FPS, thermal, memory and certification are separate from emulator CI; iOS is still deferred.
