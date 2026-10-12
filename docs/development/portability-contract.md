# Portability Contract

## Purpose

The portability contract defines the boundary between canonical gameplay and target-specific runtime behavior.

Code that must work on multiple targets should not directly depend on browser or OS-specific APIs when an adapter can express the same capability.

## Platform interfaces

Initial interface domains:

```text
platform.input
platform.storage
platform.audio
platform.haptics
platform.lifecycle
platform.purchase
```

Example portable calls:

```text
platform.haptics.impact("medium")
platform.storage.save(slot)
platform.audio.setBackgroundState(...)
platform.input.getMoveVector()
```

## Semantic input

Gameplay parity is defined using semantic actions, not target-specific raw input events.

Preferred:

```text
action(move, [0.7, 0.1])
action(jump)
action(interact, chest_04)
```

The Web and Android runtime bridges map the same action to their engine/runtime implementation.

Raw keyboard, pointer, touch, and controller emulation belongs to a separate end-to-end input-device test layer.

## Doctor rule classes

- `PF1xx` — code/API portability
- `PF2xx` — asset and mobile budget
- `PF3xx` — renderer/shader capability
- `PF4xx` — lifecycle/storage/input contract
- `PF5xx` — build/export environment
- `PF6xx` — replay/parity contract

Initial implemented examples include direct browser storage, direct browser haptics, and raw-key polling warnings.

## Replay v1

A replay contains a deterministic tick rate, RNG seed, and ordered semantic actions.

```json
{
  "schema": "talarion.replay/v1",
  "tickRate": 60,
  "seed": 20261009,
  "events": [
    { "tick": 10, "type": "move", "value": [0.71, 0.13] },
    { "tick": 126, "type": "jump", "pressed": true }
  ]
}
```

## State snapshot v0

Runtime evidence uses JSON Lines, one authoritative entity snapshot per checkpoint/tick:

```json
{
  "tick": 180,
  "entity": "enemy_guard_02",
  "state": "CHASE",
  "position": [4.12, 0.0, 8.41],
  "rotation": [0.0, 1.4, 0.0],
  "health": 80
}
```

The schema should expand only when a parity requirement demonstrates that a new field is necessary.

## Tolerance policy

Different comparison domains may require different policies:

- exact equality for discrete authoritative state
- positional tolerance for floating-point transforms
- scalar tolerance for numeric resources
- ordered matching for event streams
- specialized metrics for screenshots and frame timing

Tolerance values are project configuration, not hidden constants inside a runner.
