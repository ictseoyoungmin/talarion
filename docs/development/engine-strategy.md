# Engine Strategy

## Initial backend

The first Talarion backend targets Godot with Web and Android outputs.

The engine already owns scene execution, rendering, and target export. This lets Talarion focus on portability orchestration and evidence instead of implementing another engine or exporter.

Initial baseline configuration targets Godot 4.7.2.

## v0.1 scope

Supported direction:

```text
Godot project
    ├─ Web QA build
    └─ Android native build
```

Initial toolchain responsibilities:

- build orchestration
- target/profile resolution
- portability checks
- replay validation/delivery
- state evidence collection
- screenshot evidence
- performance evidence
- cross-runtime comparison

## Explicit non-goals for v0.1

- Unity backend
- Unreal backend
- Three.js-to-native source translation
- iOS runner
- multiplayer determinism
- cloud device farm
- visual editor

Adding all engines early would force the project to chase engine-specific scene, physics, shader, and serialization differences before the portability contract is proven.

## Future adapter model

Once the core contract is stable, engine integrations should implement an adapter interface similar to:

```text
TalarionAdapter
├─ discover_project()
├─ build(target, profile)
├─ launch(target)
├─ record_replay()
├─ run_replay()
├─ snapshot_state()
├─ capture_visual()
├─ capture_perf()
└─ report_capabilities()
```

Backend count should expand only after the contract is stable enough that a new backend validates the abstraction instead of redefining it.
