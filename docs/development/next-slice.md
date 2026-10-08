# Next Implementation Slice — TL00-R1 Replay Bridge

## Objective

Deliver the same semantic action stream into exported Web and Android runtimes and collect authoritative state from both.

## Deliverables

- Godot `TalarionBridge` autoload
- replay v1 parser inside the runtime bridge
- fixed-tick action queue
- semantic action dispatch
- authoritative state emitter
- named capture-checkpoint events
- Web runner consuming the bridge
- Android runner consuming the same bridge

## Gate

A checked-in 10-second replay must:

1. launch against the Web build;
2. launch against an Android build;
3. move the sample player through the same authored path;
4. produce state JSONL from both targets;
5. pass configured position/state tolerances.

## Follow-on slices

- **TL00-R2** — screenshot checkpoints and visual parity
- **TL00-R3** — performance telemetry and physical-device quality gate

TL00 closes only after R1–R3 satisfy the closure criteria in `tl00.md`.
