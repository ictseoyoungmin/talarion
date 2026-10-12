# Architecture

## Product boundary

Talarion is a local-first **Web-first game portability, build and evidence platform**. It is not a custom renderer, physics engine, editor or universal source-to-source converter. A game project owns its canonical gameplay source and assets; Talarion owns capability analysis, target orchestration, replay delivery, provenance, quality gates and packaging integration.

**Current implementation:** one Godot 4.7.2 Ruins Lite reference with exported Web and Android emulator runners, machine-readable contracts and CI gates. **Target architecture:** runtime-preserving Web-native to Android delivery alongside existing Godot-native exports, with separate package/release proof. This document describes both without asserting that the target architecture has been implemented.

The authoritative decisions are [ADR-001–005](adr/README.md). Existing [TL00](tl00.md) acceptance remains a reference baseline.

## Independent dimensions

~~~text
developer-owned game project
          |
      source adapter
          |
  capability inspection
          |
   runtime provider
   +------+------+-----------------+
   |             |                 |
browser JS   Android WebView   Godot Android native
   |             |                 |
web bundle    debug APK / release AAB
                 |                 |
              independent evidence and release gates
~~~

The diagram illustrates supported/planned **classes**: today only Godot -> Web and Godot -> Android debug APK are proven end to end. Web-native/WebView, release AAB and shared-native-JS providers are **unimplemented**.

The [source/runtime/artifact contract](adr/002-source-runtime-artifact-separation.md) distinguishes authoring engine, rendering backend, game-logic runtime, host OS, packaging and porting class. Do not use `android` alone as a capability identity. An Android WebView app is a real installable Android APK/AAB but does not become a native renderer. APK/AAB is an artifact distinction, not an engine.

## Game execution and rendering boundary

A game session has **one authoritative gameplay state owner**. Runtime-preserving builds leave ownership with original game code; a later opt-in portable simulation core may own state when actually integrated. Talarion's replay observer does not create a second physics/gameplay authority.

~~~text
semantic input -> authoritative game state -> renderer-specific presentation
                          |
                   state / event / capture evidence
~~~

A cross-engine IR is **optional and limited** to operations with versioned, tested semantics. glTF/GLB can transport assets, not general gameplay/physics. Rendering, physics and host APIs remain with providers unless explicitly placed under a portable execution contract. Numeric tolerance is per-domain and per-game; fixed-step replay by itself does not guarantee cross-engine determinism. See [ADR-003](adr/003-game-execution-semantics.md).

## Planned modules versus implemented modules

| Domain | Implemented today | Target direction |
| --- | --- | --- |
| Project discovery | In-repository config and read-only Godot project inspector | Explicit independent project root, safe workspace and opt-in changes |
| Adapter | Godot manifest, fixed Web/Android dispatch | Distinct source adapter, runtime provider and package builder |
| Development | Godot exported headless Web QA | Interactive Web-native development and browser feedback |
| Game QA | Canonical Replay, state, visual and telemetry CI | Per-project immutable evidence and portability matrix |
| Android | Godot native Debug APK + emulator replay | WebView APK, Release AAB, store readiness and independent device QA |
| Cross-engine | No gameplay translation | Optional bounded, conformance-tested portable subset |
| iOS | Experimental deferred export | Not an active target or release prerequisite |

## Evidence and build authority

The evidence stream must bind game source and assets, replay, runtime provider/toolchain, built artifact and the observed device to every result. Static preflight cannot attest to runtime. Emulator tests cannot certify hardware. Source/game-specific parity, visual fidelity, performance and release policy gates are separate. See [ADR-004](adr/004-evidence-and-android-release-authority.md).

Builds should eventually form a typed, provenance-aware dependency graph with isolated outputs; **today** `talarion plan` is a configured target list, not an executable graph. Projects remain developer-owned, and static analysis must not execute plugins or modify game files. See [ADR-005](adr/005-project-isolation-and-build-graph.md).

## Next verification milestone

Follow [next-slice.md](next-slice.md). Freeze this design boundary, then implement one independent browser-playable Web-native game, runtime-preserving Android Debug APK and a separate Release AAB proof. Keep legacy Godot TL00 15/15 authoritative states, 3/3 strict visual checkpoints and 9/9 machine acceptance on every source-change PR. No cross-engine claim or Play publication is inferred from these experiments.
