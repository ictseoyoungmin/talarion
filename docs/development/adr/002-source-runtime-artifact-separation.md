# ADR-002 — Source / Renderer / Runtime / Artifact Separation

Status: **Accepted (design only)**  
Date: 2026-10-13

## Decision

A `target=android` flag is insufficient to describe portability. A build must declare **independent identity fields** for:

| Dimension | Meaning | Illustrative values |
| --- | --- | --- |
| Source provider | Game authoring implementation | `godot`, `babylon`, `three`, `web-2d` |
| Render backend | Actual graphics implementation | `webgl`, `webgpu`, `godot-mobile`; `unknown` is valid |
| Runtime provider | Executes game logic | `browser-js`, `android-webview`, `godot-native`, future native JS host |
| Host platform | OS/environment | `desktop-web`, `android` |
| Packaging | Delivered format | `web-bundle`, `debug-apk`, `release-aab` |
| Porting class | What is preserved | `same-runtime`, `shared-runtime`, `cross-engine`, `partial`, `unsupported` |

The mapping is many-to-many, not a hardcoded one-engine/one-OS switch. A WebView-based APK is an installable Android game but not a native-renderer port; a Godot Android APK uses a distinct runtime provider.

## Responsibility boundaries

- **Source adapter:** discover the original project, authoring engine/version and required capabilities. Must not rewrite sources during inspection.
- **Runtime provider:** package/run the game logic and supply input, lifecycle, storage and graphics host capabilities. Owns explicit lifecycle/resource boundaries.
- **Artifact builder:** produce a named Web bundle, debug APK or release AAB; record signing mode and source/build provenance.
- **Evidence runner:** observe the built artifact, not the declarative capability label; record actual device/emulator, renderer and runtime identities.
- **Compatibility planner:** compare *required* capabilities and *observed/declared* provider support with states `supported | unsupported | unknown | requires-fallback`. An unknown or unsupported required capability blocks an unqualified portability claim.

Each provider declares a versioned interface contract and testable feature coverage, rather than implying that a host platform guarantees identical GPU, scripting or physics semantics.

## Planned declarative model (not executable config)

The sample below is **illustrative only**. Today's `talarion.config.json` schema remains v1 and does **not** accept this model.

~~~json
{
  "source": { "kind": "babylon", "projectRoot": "../my-game" },
  "execution": {
    "host": "android",
    "runtime": "android-webview",
    "renderBackend": "webgl",
    "portingClass": "same-runtime"
  },
  "artifact": { "kind": "release-aab" }
}
~~~

Identity and capability proof **cannot** be inferred solely from this declaration. Product versions, platform APIs and permissions are pinned/inspected at build and observed at runtime where feasible.

## Candidate porting routes

1. Browser Web -> Android WebView: preserve JS, assess Web APIs, offline assets and lifecycle. May share logic but has different rendering/OS behavior.
2. Godot -> Godot Web / native Android: preserve game project, distinct renderer/runtime behavior. Existing, verified reference route.
3. Babylon.js -> native JS host: experimental, unsupported until real device/emulator runs and capability auditing.
4. Portable subset -> Godot or another provider: cross-engine only for versioned semantics actually implemented and tested.

## Consequences

No coercion of a WebView app into `cross-engine`; no assumption that `release-aab` implies signed, compliant or published. Migration from existing `targets.web/android` must be additive and preserve the TL00 reference config until a separate tested schema migration is accepted.

References: [ADR-001](001-web-first-product-scope.md), [ADR-004](004-evidence-and-android-release-authority.md).
