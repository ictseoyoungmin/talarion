# Open-Source Product Strategy

## Positioning

**Web-first game development -> verifiable Android game release**, without forcing source translation into a specific native game engine. Talarion provides portability planning, integration, build orchestration, runtime evidence and release preflight; it is not a replacement for game engines.

The first user-facing workflow should be a genuine small playable **Web-native game** followed by the same source packaged as an Android Debug APK, then an independently verified release AAB. The existing Godot Ruins Lite reference is a maintained separate regression path, not evidence that Web-native adoption already works.

## Success criteria

- User can work in a preferred Web engine and run the game interactively during iteration.
- Same project produces inspectable browser and Android game evidence without silent gameplay-source rewrites.
- Packaging mechanism is transparent: embedded WebView vs Godot-native/other native host.
- Every claim identifies observed build, runtime, game-state/visual parity, performance budget and independent Play-readiness status.
- Acceptance gates are based on reproducible artifacts, not the number of supported adapters or nominal conversions.

## Local-first / OSS rules

Core workflows must work locally or in self-hosted CI with no paid service, vendor API key or background AI dependency. Optional hosted device labs or Play upload integrations require explicit user action and permissions. Games retain their original licenses and asset rights; third-party runtime/provider licenses must be reviewed before packaging.

Prefer versioned machine-readable contracts, fail-closed unknowns, scoped file operations and independent evidence provenance. Never imply real-device performance or Google Play publication from emulator runs. Retain MIT project licensing.

See [ADR decisions](adr/README.md), [next slices](next-slice.md) and [release certification](release-certification.md).
