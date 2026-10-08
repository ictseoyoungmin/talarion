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

Available today in the repository:

- project and target configuration
- Godot executable/project discovery
- Web/Android export orchestration
- baseline portability checks
- replay schema validation
- JSONL state snapshot format
- tolerance-based state comparison
- HTML parity reports
- machine-readable `--json` output
- a minimal Godot 3D sample project

The full runtime parity gate is still in development. Automated Web replay, Android device replay, screenshot parity, and device performance capture are not yet complete.

## Quick start

Requirements:

- Node.js 20+
- Godot for build commands
- Godot export templates for Web/Android exports
- Android SDK/JDK for Android builds

Clone the repository and run the self-check:

```bash
git clone https://github.com/ictseoyoungmin/talarion.git
cd talarion
npm run verify
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

With Godot and export templates configured:

```bash
node bin/talarion.mjs build web
node bin/talarion.mjs build android
```

All major commands can return structured output:

```bash
node bin/talarion.mjs doctor --json
node bin/talarion.mjs verify --json
```

## Configuration

`talarion.config.json` defines the engine project, target export presets, quality profiles, and parity tolerances.

```json
{
  "project": {
    "engine": "godot",
    "path": "examples/ruins-lite"
  },
  "targets": {
    "web": { "preset": "Web", "profile": "web-qa" },
    "android": { "preset": "Android", "profile": "android-low" }
  },
  "parity": {
    "positionTolerance": 0.1,
    "scalarTolerance": 0.001
  }
}
```

## Repository layout

```text
bin/                    CLI entrypoint
src/
  adapters/             engine integration
  commands/             CLI commands
  core/                 configuration and process utilities
  parity/               state comparison
  runners/              runtime-runner contracts
examples/ruins-lite/    minimal Godot 3D sample
fixtures/                replay and state fixtures
docs/development/       architecture and implementation documentation
```

## Development documentation

Architecture, contracts, implementation gates, and roadmap are maintained under [`docs/development/`](docs/development/README.md).

## License

MIT License. See [LICENSE](LICENSE).
