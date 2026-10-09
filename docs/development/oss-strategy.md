# Open-Source Product Strategy

## Positioning

Talarion should remain focused on continuous portability proof rather than becoming a general-purpose game engine.

Product promise:

> Build on the web. Know it will survive mobile.

## First-run experience

The repository should make the product value visible quickly:

1. run a small polished Web sample;
2. execute the same replay on Android;
3. inspect a parity report;
4. reproduce the workflow from a short CLI sequence.

A representative sample should resemble a small finished game slice rather than a renderer test scene.

## Local-first requirement

Core workflows must work locally and in self-hosted CI:

- build
- replay
- state comparison
- visual comparison
- report generation

Optional hosted services can later provide device farms, remote builds, team dashboards, or long-term evidence storage. Core functionality must not require them.

## Machine-readable interfaces

Primary commands should support structured output suitable for CI and coding agents:

```bash
talarion doctor --json
talarion plan --json
talarion compare ... --json
talarion verify --json
```

Automation should operate on deterministic tool outputs. AI is not a runtime dependency.

## Scope discipline

The initial public scope is Godot + Web + Android. Additional engines and targets should be added only when the portability and runner contracts are stable.

## Licensing

The repository uses the MIT License. A game's licensing remains independent from its use of the Talarion toolchain.
