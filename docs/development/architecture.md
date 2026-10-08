# Architecture

## Product boundary

Talarion is portability and cross-runtime QA infrastructure. It does not implement a renderer, physics engine, editor, or source-to-source game converter.

The game engine remains responsible for scene execution and rendering. Talarion is responsible for target orchestration, portability constraints, replay delivery, evidence collection, and cross-runtime comparison.

## Canonical game source

Game state and content remain authoritative in one project:

```text
gameplay/core       world/content       game schema
      \                  |                 /
       +------------------+----------------+
                          |
                 portability layer
                          |
       +------------------+----------------+
       |                  |                |
      Web              Android            iOS
```

Target-specific differences must not create independent gameplay implementations.

## Portability layer

Portable gameplay uses explicit platform interfaces instead of direct target APIs:

```text
platform.input
platform.storage
platform.audio
platform.haptics
platform.lifecycle
platform.purchase
```

A target adapter implements those interfaces for its runtime.

## Render boundary

Engine-specific rendering objects should not leak into portable gameplay logic when a higher-level description is sufficient.

```text
Game Logic
    ↓
World State
    ↓
Render Intent
    ↓
Engine / Renderer Backend
```

Representative render intent:

```text
spawn entity
mesh = character_003
material = skin_02
animation = run
lod_policy = character_near
```

## Target profiles

Target quality differences belong in declarative profiles rather than gameplay forks. Profiles can control:

- texture maximum and compression policy
- LOD policy
- shadow quality
- particle budget
- draw-call budget
- frame-rate target
- post-processing tier
- evidence/debug instrumentation

Initial profiles:

- `web-qa` — fast build and automated evidence collection
- `android-low` — constrained mobile budget
- later native high-end/iOS profiles

## Core subsystems

### Portability Doctor

Static and project-level checks that detect non-portable APIs, unsupported capabilities, asset-budget violations, and missing target configuration.

### Replay and Parity

A semantic action stream is replayed against multiple runtimes. Authoritative state, visual checkpoints, events, and performance evidence are compared under explicit tolerances.

### Build Graph

A reproducible graph resolves canonical project + target profile + adapter + evidence steps into target artifacts and parity reports.

## Design constraints

1. Portability is checked continuously rather than after feature completion.
2. Web is the primary fast iteration surface, not a substitute for physical-device QA.
3. Runtime runners return evidence, not only exit codes.
4. Structured output is a first-class interface for CI and coding agents.
5. Backend expansion follows contract stability; engine count is not an early success metric.
