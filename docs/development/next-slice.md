# Next Implementation Slice — TL00-R2 Visual Parity

## Objective

Capture the same named visual checkpoints from exported Web and Android runtimes, normalize target-specific framebuffer differences, and produce reproducible visual similarity evidence.

## R1 baseline

The runtime state gate is complete:

- [x] canonical 600-tick replay staged without mutation
- [x] Web replay executes to tick 600
- [x] Android emulator replay executes to tick 600
- [x] Web state evidence collected
- [x] Android state evidence collected
- [x] CI downloads both runtime evidence artifacts
- [x] 15/15 snapshots matched
- [x] state parity = 100.00%

## R2 deliverables

- [x] Web named checkpoint screenshot capture
- [x] Android checkpoint screenshot implementation
- [ ] Android screenshot capture validated in CI
- [ ] screenshot metadata records source dimensions and normalization
- [ ] target-independent normalization policy
- [ ] per-checkpoint visual similarity metric
- [ ] generated visual diff images
- [ ] visual thresholds configurable in `talarion.config.json`
- [ ] visual results included in the parity report
- [ ] visual parity CI gate

## Checkpoints

The canonical replay currently defines:

- `after-jump`
- `interaction`
- `attack`

Both runtimes must emit one screenshot for every declared checkpoint.

## Gate

R2 closes only when:

1. Web and Android produce the same checkpoint set;
2. screenshots are normalized deterministically;
3. every checkpoint is compared using a declared metric and threshold;
4. diff images are emitted for inspection;
5. the visual result is machine-readable and included in the CI parity evidence.

## Follow-on

**TL00-R3** adds performance telemetry and physical-device validation before TL00 can close.
