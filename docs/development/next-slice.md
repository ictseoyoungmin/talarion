# Next Implementation Slice — TL00-R1 Runtime Validation

## Objective

Validate the implemented Web and Android runtime runners against real exported builds and compare the authoritative state streams produced by the same canonical replay.

## Implemented R1 infrastructure

- [x] Godot `TalarionBridge` autoload
- [x] replay v1 parser inside the runtime bridge
- [x] fixed-tick action queue
- [x] semantic action dispatch
- [x] named capture-checkpoint events
- [x] authoritative state log protocol
- [x] canonical replay staging into exported Godot resources
- [x] byte-identity test between canonical and staged replay
- [x] runtime bridge structural contract checks
- [x] shared runtime evidence parser
- [x] Playwright Web runner implementation
- [x] ADB Android runner implementation
- [x] `talarion test web|android` orchestration

## Remaining R1 validation gates

- [ ] export the sample Web build with the target Godot version
- [ ] complete a real Playwright replay run
- [ ] collect Web state evidence through replay finish
- [ ] export/install the sample Android build
- [ ] complete a real ADB replay run on an authorized device or emulator
- [ ] collect Android state evidence through replay finish
- [ ] compare the two real-runtime state streams
- [ ] pass configured position/state tolerances

## Gate

A checked-in 10-second replay must:

1. be staged without mutation into both target builds;
2. execute through the same `TalarionBridge` semantic action contract;
3. move the sample player through the same authored path;
4. produce state JSONL from both targets;
5. pass configured position/state tolerances.

## Follow-on slices

- **TL00-R2** — screenshot parity hardening
- **TL00-R3** — performance telemetry and physical-device quality gate

TL00 closes only after R1–R3 satisfy the closure criteria in `tl00.md`.
