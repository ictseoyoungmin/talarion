# Architecture Decision Records

These records define **target architecture**, not implemented features. A design being accepted never proves an integration, build, runtime, device or store release. Implementation and acceptance must be tracked independently.

| Decision | Status | Boundary |
| --- | --- | --- |
| [ADR-001](001-web-first-product-scope.md) | Accepted — design | Web-first product, supported promise and explicit non-goals |
| [ADR-002](002-source-runtime-artifact-separation.md) | Accepted — design | Source, renderer, runtime, host target and artifact separation |
| [ADR-003](003-game-execution-semantics.md) | Accepted — design | State authority, replay semantics and optional portable IR |
| [ADR-004](004-evidence-and-android-release-authority.md) | Accepted — design | Per-project proof, APK/AAB and Google Play readiness |
| [ADR-005](005-project-isolation-and-build-graph.md) | Accepted — design | Non-destructive adoption, isolation, provenance and build graph |

Priority: implement [the gated next slice](../next-slice.md) before claiming any new Web-native-to-Android capability. The verified Godot Ruins Lite reference remains unchanged and serves as a regression fixture. Any future ADR replacement requires explicit supersession with migration and test impact, not silent edits.

Review checklist for each new integration: (1) runtime/packaging are independently identified; (2) state owner and capability limits explicit; (3) provenance binds evidence to that game's source and build; (4) inspection never executes third-party code; (5) release claims require independent Android/Play evidence.
