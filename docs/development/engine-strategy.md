# Engine and Runtime Strategy

## What is implemented now

The **Godot reference backend** exports the canonical Ruins Lite project to Web and Android Debug APK. Exported Web and Android emulator replay/parity are CI verified. Godot remains a supported engine; the current build/test CLI and config schema are Godot-specific.

This is not proof that arbitrary Babylon.js, Three.js or 2D projects run through Talarion. It does not generate a WebView app or Play Release AAB today.

## Target provider strategy

Authoring source and execution provider are different choices:

| Source | Execution class | Status |
| --- | --- | --- |
| Godot | Browser export / Godot-native Android | Verified for canonical sample |
| Babylon.js / Three.js / browser 2D | Browser JS | Next reference integration; not implemented |
| Web-native project | Android WebView (same game JS) | Next release vertical slice; not implemented |
| Babylon.js | Native JavaScript host | Research candidate; not certified |
| Portable game subset | Cross-engine provider such as Godot | Experimental after semantic conformance |
| Any project | iOS | Deferred |

First implement a single **browser-native gameplay reference**; Babylon.js is a candidate for the first 3D slice, **not a mandatory proprietary source format**. Keep 2D and 3D render providers independent above common input/evidence contracts.

## Provider interfaces

A planned source adapter discovers a project and declares capabilities; a runtime provider launches the game and observes actual runtime APIs; an artifact builder packages outputs. The current Godot adapter manifest and allowlisted dispatch are **not** already these three independent interfaces.

Portability classes: `same-runtime` (original JS embedded), `shared-runtime` (same logic under a different host), `cross-engine` (two semantics-conformant engines), `partial`, `unsupported`. Explicit required and available capabilities determine whether a route is eligible. Unsupported/unknown requirements must fail closed.

## Avoiding a second engine implementation

Do not write a general-purpose renderer, physics engine or universal source compiler to make the first WebView package work. Keep game logic with original source on runtime-preserving paths. Introduce only the operator subset actually demonstrated in two engines, with strict meaning and tests; engine-specific shaders, physics and APIs remain extensions or unsupported.

See [the accepted architecture decisions](adr/README.md), [current architecture](architecture.md) and [gated implementation plan](next-slice.md).
