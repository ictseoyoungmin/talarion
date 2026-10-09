# QA and Cross-Runtime Parity

## Goal

The same replay should produce equivalent authoritative gameplay behavior across supported runtimes, with differences measured rather than inferred from visual inspection alone.

## Evidence domains

Parity can compare:

- entity transforms
- physics contacts and authoritative physics state
- animation state
- AI state
- inventory/resources
- trigger state
- camera transform
- ordered gameplay events
- RNG/checkpoint state
- named screenshots
- frame time, FPS, memory, and target-specific performance metrics

## Replay flow

```text
Record semantic actions
        ↓
Checked-in replay artifact
        ↓
+-------+--------+
|                |
Web runner    Android runner
|                |
+-------+--------+
        ↓
state + visual + performance evidence
        ↓
parity report
```

The authoritative parity layer injects semantic actions. Raw device-input tests are complementary but do not define gameplay equivalence.

## Report expectations

A parity report should include:

- target/build identity
- replay identity and seed
- configured tolerance values
- matched and divergent checkpoints
- concise divergence details
- visual checkpoint results when available
- performance results when available
- machine-readable source artifact references

Example summary:

```text
Web ↔ Android
state match          99.98%
camera divergence    0.03%
physics divergence   0.07%
visual similarity    0.96
```

## QA cadence

Web QA is expected to run more frequently because it is cheap and automatable. Physical-device QA remains mandatory.

```text
every commit        → Web automated QA
major feature       → Web full QA + Android smoke build
vertical slice end  → physical Android/iOS QA
release candidate   → supported-target parity gate
```

## Mobile-specific checks

Browser success does not prove mobile readiness. Physical-device gates should eventually cover:

- thermal throttling
- tile-based GPU behavior
- memory bandwidth and pressure
- texture compression differences
- audio latency/lifecycle
- touch sampling and safe areas
- suspend/resume
- process/background termination
- haptics

## Determinism scope

Talarion should prefer deterministic gameplay inputs and authoritative checkpoints without requiring every renderer detail to become bitwise deterministic. Visual parity and state parity are separate measurements.
