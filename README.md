# Talarion

**One game. Many runtimes.**

Talarion is an open-source portability and cross-runtime QA toolchain for 3D games. It is designed for a web-first development loop while keeping native mobile targets continuously verifiable.

Talarion does not replace a game engine. It adds a portability layer around an existing project so the same game can be built, replayed, measured, and compared across runtimes.

## Why Talarion

A web build is ideal for fast iteration, automated capture, remote review, and headless QA. Native mobile builds expose different constraints: lifecycle behavior, graphics capabilities, memory pressure, input, thermals, and device-specific performance.

Talarion connects those workflows around three capabilities:

- **Portability Doctor** — detects code, asset, and target assumptions that can become porting debt.
- **Deterministic Replay & Parity** — runs the same gameplay actions across runtimes and compares authoritative state.
- **Build Graph** — makes target builds and QA evidence reproducible from the command line.

## Project status

Talarion is in early development. **Godot Web and Android are the currently maintained and CI-verified targets**, backed by exported runtime state, strict visual and telemetry evidence. The adapter interface is the next development focus. iOS remains an optional, **deferred experimental export capability**, not a prerequisite for using or developing Talarion. This is not a certification of all Android devices or production-game performance.

Available in the repository:

- project and target configuration
- Godot executable/project discovery
- Web/Android export orchestration
- canonical replay staging into target builds
- Godot fixed-tick `TalarionBridge`
- baseline portability checks
- replay schema validation
- JSONL state snapshot format
- tolerance-based state comparison
- HTML parity reports, checkpoint difference images and visual parity metrics
- Playwright Web runner implementation
- ADB Android runner implementation
- machine-readable `--json` output
- a minimal Godot 3D sample project

The first Web/Android vertical slice is CI-verified using exported Godot Web and Android emulator runtimes. Physical Android hardware is **not required for baseline portability QA**; hardware performance and device compatibility claims require a separate [release certification](docs/development/release-certification.md). The runners require a working Godot toolchain and an authorized Android device **or emulator**.

## Quick start

Requirements:

- Node.js 20+
- Godot with Web/Android export templates
- Android SDK/JDK and ADB for Android builds
- Chromium installed through Playwright for automated Web runs

Clone and install:

```bash
git clone https://github.com/ictseoyoungmin/talarion.git
cd talarion
npm install
npx playwright install chromium
```

Run repository checks:

```bash
npm run self-check
```

Inspect the project:

```bash
node bin/talarion.mjs doctor
node bin/talarion.mjs plan
```

Validate a replay:

```bash
node bin/talarion.mjs replay validate fixtures/replay/tutorial.tlr.json
```

Compare two state streams:

```bash
node bin/talarion.mjs compare \
  fixtures/state/web.jsonl \
  fixtures/state/android.jsonl
```

Compare checkpoint image evidence from runtime runner outputs:

```bash
node bin/talarion.mjs visual compare \
  artifacts/run/web artifacts/run/android artifacts/parity/visual
```

Generate an HTML parity report:

```bash
node bin/talarion.mjs report \
  fixtures/state/web.jsonl \
  fixtures/state/android.jsonl \
  artifacts/parity-report.html \
  artifacts/parity/visual/result.json
```

The optional final argument adds screenshot comparison cards to the HTML report. The visual command requires actual Web and Android runtime evidence; fixture-only tests do not prove visual parity.

Build target exports:

```bash
node bin/talarion.mjs build web
node bin/talarion.mjs build android
```

Run an exported target through its runtime runner:

```bash
node bin/talarion.mjs test web
node bin/talarion.mjs test android
```

The Web runner serves the exported game locally, opens it in headless Chromium, and collects the Talarion state protocol from the browser console.

The Android runner installs the APK with ADB, launches the app, and collects the same protocol from logcat.

All major commands support structured output where applicable:

```bash
node bin/talarion.mjs doctor --json
node bin/talarion.mjs verify --json
node bin/talarion.mjs test web --json
```

## Portability Doctor

Doctor scans portable gameplay for Web/Android dependencies and reports rule ID, affected target, capability, source position and a suggested remediation. Warnings require review and are not proof that a game will fail. Optional adapter declarations and their limitations are documented in [TL01-P1](docs/development/tl01-p1.md). Source image and mobile profile limitations are described in [TL01-P2](docs/development/tl01-p2.md); they do not certify GPU memory, draw calls or physical-device FPS.

Export a standalone, offline diagnostic report with remediation guidance:

```bash
node bin/talarion.mjs doctor report artifacts/doctor --json
```

The command writes `artifacts/doctor/doctor-report.json` and `doctor-report.html`. Reports use stable rule/file identifiers and an explicit static-analysis-only authority scope. See [TL01-P3](docs/development/tl01-p3.md) for exit status, deterministic content and format limits.

```bash
node bin/talarion.mjs doctor --json
```

## Performance evidence authority (TL02)

Talarion distinguishes configured FPS/draw-call goals from engine-observed performance evidence. The authority check recomputes the runner's engine telemetry from raw JSONL and verifies replay/device provenance:

```bash
node bin/talarion.mjs budget authority \
  artifacts/run/web artifacts/run/android artifacts/parity/performance-authority.json --json
```

The output reports observed sample metrics and declared goals separately. It deliberately sets the budget decision to `not-evaluated`: the emulator cannot certify target FPS, physical-device performance, draw calls or thermals. TL02-P1 also validates the source metric units and coverage of optional `processMsP95Budget` / `peakMemoryBytesBudget` targets, with draw calls explicitly unobserved. See the [TL02-P0 evidence contract](docs/development/tl02-p0.md), [TL02-P1 metric contract](docs/development/tl02-p1.md) and [TL02-P2 measurement windows](docs/development/tl02-p2.md). P2 selects fixed replay-tick samples after warmup and reports per-run distributions. TL02-P3 creates deterministic, offline performance review JSON/HTML for verified single- or multi-run evidence:

```bash
node bin/talarion.mjs budget report current artifacts/parity/performance-authority.json artifacts/parity/performance-review --json
node bin/talarion.mjs budget report evidence/cohorts.json artifacts/performance-review --json
```

The default CI publishes an `evidence-only` report from **one Web and one Android run**; it does not invent multi-run performance PASS. External baseline/candidate cohort manifests require SHA-256-pinned authority artifacts and independent runtime identities. See [TL02-P3](docs/development/tl02-p3.md).

## Optional iOS capability preflight (deferred)

iOS support is **experimental and deferred**, not a maintained or verified runtime target and not a hidden alias for Android. The diagnostic remains available without building or certifying iOS:

```bash
node bin/talarion.mjs ios preflight artifacts/ios/ios-preflight.json --json
```

The output deliberately reports `status: "blocked"` on Linux CI; `ok: true` means the preflight audit ran, **not** that iOS export or simulator/device replay succeeded. The tool checks Apple Xcode/SDK prerequisites, bundle/team/preset and simulator renderer constraints. See [TL03-P0](docs/development/tl03-p0.md).

## Optional iOS Xcode project export (deferred, TL03-P1)

The iOS adapter's code is retained for a future opt-in effort; it is **not part of the current Web/Android support or CI acceptance contract**. On a provisioned **macOS** host with full Xcode, both iPhoneOS/iPhoneSimulator SDKs, Godot and matching iOS export templates, configure a real nonsecret Apple Team ID in both `talarion.config.json` and the `iOS` preset's `application/app_store_team_id` field. The sample deliberately leaves these unset; no dummy Team ID or signing credentials are shipped.

```bash
node bin/talarion.mjs ios preflight artifacts/ios/preflight.json --json
node bin/talarion.mjs ios export artifacts/build/ios --json
```

A successful export produces `ios-export.json`, `ios-preflight.json` and a SHA-256-fingerprinted Godot iOS ZIP containing an Xcode `.xcodeproj/project.pbxproj`. Export fails closed on Linux/Windows, missing prerequisites, mismatched bundle/team identifiers, unsafe output paths, existing ZIPs, Godot failure or invalid archives. This **does not** certify an Xcode compilation, Apple signing, simulator/device execution or iOS parity. Real macOS export evidence is uncollected, and iOS development is deferred; see [TL03-P1](docs/development/tl03-p1.md) and the [roadmap](docs/development/roadmap.md).

## TL00 automated acceptance

The CI baseline requires real exported Web/Android replay, state and visual parity, valid engine telemetry and source fingerprints. It does **not** grade emulator FPS against physical-device targets. Reproduce the final acceptance result after capturing both runtimes:

```bash
node bin/talarion.mjs gate tl00 \
  artifacts/run/web artifacts/run/android \
  artifacts/parity/visual/result.json \
  artifacts/parity/tl00-acceptance.json
```

This writes a machine-readable acceptance decision. Hardware certification is a separate process; an emulator PASS never counts as a device certification.

## Configuration

`talarion.config.json` defines the engine project, canonical replay, target export presets, target quality profiles, Android package, and parity tolerances.

```json
{
  "project": {
    "engine": "godot",
    "path": "examples/ruins-lite"
  },
  "replay": {
    "default": "fixtures/replay/tutorial.tlr.json"
  },
  "targets": {
    "web": {
      "preset": "Web",
      "profile": "web-qa"
    },
    "android": {
      "preset": "Android",
      "profile": "android-low",
      "package": "dev.talarion.ruinslite"
    }
  },
  "parity": {
    "positionTolerance": 0.1,
    "scalarTolerance": 0.001
  }
}
```

## Repository layout

```text
bin/                       CLI entrypoint
src/
  adapters/                engine integration
  commands/                CLI commands
  core/                    configuration and process utilities
  parity/                  state comparison
  runners/                 Web/Android runtime runners
  runtime/                 replay staging and evidence protocol
examples/ruins-lite/       minimal Godot 3D sample
fixtures/                  replay and state fixtures
test/                      Node contract tests
docs/development/          architecture and implementation documentation
```

## Development documentation

Architecture, contracts, runtime gates, and roadmap are maintained under [`docs/development/`](docs/development/README.md).

## License

MIT License. See [LICENSE](LICENSE).

## Runtime telemetry

Web and Android runners emit `performance.jsonl` and a `talarion.performance/v1` summary in `runner-result.json`. These are observational CI diagnostics, not physical-device performance certification.
