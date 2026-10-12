# ADR-001 — Web-first Product Scope

Status: **Accepted (design only)**  
Date: 2026-10-13

## Decision

Talarion is a **local-first game portability, build and evidence platform**, not a general-purpose renderer, physics engine, visual editor or universal source-to-source translator. Developers may author games in an independent Web-native engine or in an engine that exports Web builds. The developer's project remains the canonical source. Web is the fastest interactive development surface; Android is a first-class **installable and releasable game** target, not solely a mobile preview.

Two independently useful product promises:

1. **Runtime-preserving delivery:** keep a Web game's original logic/runtime where possible (browser -> embedded Android Web runtime). This can produce real APK/AAB artifacts while remaining a WebView-based game. It must not be described as a native rendering-engine conversion.
2. **Proven engine-backed delivery:** retain the currently verified Godot -> Web / Godot-native Android path. Other native hosts or cross-engine paths become supported only after real exported gameplay and release-appropriate evidence.

An **optional constrained portable execution subset** may later carry explicit game semantics to multiple providers. Arbitrary Babylon.js, Three.js or Godot scripts are **not** automatically portable. The common IR is not a required build step for runtime-preserving games.

## Product surfaces

- Interactive Web development and debugging (future: development server, live reload when supported, playable browser; **not** supplied by today's headless `test web`).
- Observational QA: replay, state, screenshots, performance and platform portability diagnostics.
- Android packaging: debug APK for install/test; release AAB for Play upload, with a separately verified release-readiness process.
- Engine-neutral agent/CI interfaces with structured, versioned and fail-closed errors.

## Scope boundaries

- Do not implement an in-house general renderer, physics engine, native OS shell, store service or source-code converter without a demonstrated critical need.
- Do not advertise Google Play readiness from an AAB alone; publishing depends on Google Play's own review and current policies.
- iOS remains deferred. Web-first priority does not invalidate completed Godot TL00–TL05-P0 evidence.
- Engine count and number of declared capabilities are not quality metrics; proven real-game adoption is.
- Games are not forced to give Talarion ownership of their proprietary source, assets, signing keys or game state.

## Alternatives considered

- Godot-only: lowest current implementation cost, but fails the developer need to begin in arbitrary Web libraries.
- Full custom engine and universal IR: requires ownership of physics, rendering, tooling and engine-specific behavior; not justified.
- WebView-only: fastest path to an Android app, but cannot satisfy all native performance, lifecycle or graphics requirements.
- Selected: runtime-preserving first, multiple explicitly qualified runtime providers later, IR as optional proven subset.

## Consequences and verification

Current support remains **Godot Web and Android emulator**. No Babylon.js/Three.js Web runtime, Android WebView packager, native JS host or release AAB is implemented by this ADR.

The next proof uses one independent playable Web-native game with a real development loop, and a separate Android APK/AAB path evaluated with security/performance/behavior evidence. A cross-engine IR experiment is **not** a launch dependency.

References: [ADR-002](002-source-runtime-artifact-separation.md), [ADR-003](003-game-execution-semantics.md), [next slice](../next-slice.md).
