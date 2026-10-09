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
- [x] screenshot metadata records source dimensions and normalization
- [x] target-independent normalization policy (center-crop-nearest-rgb-v1)
- [x] per-checkpoint visual similarity metric (normalized mean absolute RGB difference)
- [x] generated visual diff images
- [x] visual thresholds configurable in `talarion.config.json`
- [x] visual results included in the parity report
- [x] visual parity CI gate implemented (runtime PASS pending)

## Checkpoints

The canonical replay currently defines:

- `after-jump`
- `interaction`
- `attack`

Both runtimes must emit one screenshot for every declared checkpoint.

## Normalization and evidence contract

Each named checkpoint requires exactly one PNG from each runner, with its authoritative replay tick. Both screenshots are center-cropped to the configured aspect ratio and sampled at fixed pixel centers (default 320 × 180); the crop offsets and original dimensions are retained. Pixel RGB mean absolute error is converted into a similarity score. Low-contrast/blank screenshots fail independently of similarity, and missing/invalid images fail closed. The three normalized PNG files (Web, Android, absolute-difference heatmap) and `result.json` are uploaded with the HTML parity report.

This policy is intentionally simple. Center cropping can hide edge framing errors; it is only the first visual contract, not a proof of full-screen visual equivalence or device UI parity. The threshold is a declared project setting, not an adaptive value chosen to force PASS.

## Gate

R2 closes only when:

1. Web and Android produce the same checkpoint set;
2. screenshots are normalized deterministically;
3. every checkpoint is compared using a declared metric and threshold;
4. diff images are emitted for inspection;
5. the visual result is machine-readable and included in the CI parity evidence.

## Follow-on

**TL00-R3** adds performance telemetry and physical-device validation before TL00 can close.
