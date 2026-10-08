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

Talarion is in early development. The first implementation target is **Godot + Web + Android**.

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
- HTML parity reports
- Playwright Web runner implementation
- ADB Android runner implementation
- machine-readable `--json` output
- a minimal Godot 3D sample project

The physical cross-runtime parity gate is still open. The runner implementations require a working local Godot toolchain and, for Android, an authorized device or emulator.

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

Generate an HTML parity report:

```bash
node bin/talarion.mjs report \
  fixtures/state/web.jsonl \
  fixtures/state/android.jsonl \
  artifacts/parity-report.html
```

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
