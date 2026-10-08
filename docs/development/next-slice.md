# Next Implementation Slice — TL00-R1 Runtime Execution

## Objective

Execute the checked-in semantic replay in exported Web and Android runtimes and collect authoritative state from both.

## Implemented bridge foundation

- [x] Godot `TalarionBridge` autoload
- [x] replay v1 parser inside the runtime bridge
- [x] fixed-tick action queue
- [x] semantic action dispatch
- [x] named capture-checkpoint events
- [x] authoritative state log protocol
- [x] canonical replay staging into exported Godot resources
- [x] byte-identity test between canonical and staged replay
- [x] runtime bridge structural contract checks

## Remaining R1 deliverables

- [ ] Web runner launches the exported build
- [ ] Web runner captures `TALARION_STATE` output
- [ ] Android runner installs and launches the exported APK through ADB
- [ ] Android runner captures the same state protocol
- [ ] `talarion test web`
- [ ] `talarion test android`
- [ ] Web ↔ Android real-runtime state comparison

## Gate

A checked-in 10-second replay must:

1. be staged without mutation into both target builds;
2. execute through the same `TalarionBridge` semantic action contract;
3. move the sample player through the same authored path;
4. produce state JSONL from both targets;
5. pass configured position/state tolerances.

## Follow-on slices

- **TL00-R2** — screenshot checkpoints and visual parity
- **TL00-R3** — performance telemetry and physical-device quality gate

TL00 closes only after R1–R3 satisfy the closure criteria in `tl00.md`.
