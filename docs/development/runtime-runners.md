# Runtime Runner Contract

Runtime runners convert a target build plus replay into comparable evidence.

## Inputs

Every runner receives:

```text
target
build artifact
replay artifact
capture checkpoints
target profile
```

## Required output

```json
{
  "schema": "talarion.runner-result/v1",
  "target": "web",
  "ok": true,
  "build": "artifacts/build/web/index.html",
  "replay": "fixtures/replay/tutorial.tlr.json",
  "evidence": {
    "stateFile": "artifacts/run/web/state.jsonl",
    "screenshots": [
      { "checkpoint": "start", "file": "artifacts/run/web/start.png" },
      { "checkpoint": "interaction", "file": "artifacts/run/web/interaction.png" }
    ],
    "performance": {
      "fpsMedian": 60,
      "frameMsP95": 18.1
    }
  },
  "warnings": []
}
```

A successful process exit without evidence is not a successful runner result.

## Web runner

Planned backend: Playwright.

Responsibilities:

1. serve/open the exported Web build;
2. establish the Talarion replay bridge;
3. inject semantic actions on deterministic ticks;
4. collect the Talarion state stream;
5. capture named screenshots;
6. collect browser timing metrics;
7. emit `talarion.runner-result/v1`.

## Android runner

Planned backend: ADB plus an in-game Talarion bridge.

Responsibilities:

1. discover/select a device;
2. install the exported APK;
3. launch with replay/session configuration;
4. collect the state stream;
5. capture named screenshots;
6. collect frame/memory/device telemetry;
7. emit `talarion.runner-result/v1`.

## Shared semantics

The Web and Android runners must not implement different gameplay semantics.

```text
Replay action
     ↓
Talarion runtime bridge
   /             \
 Web           Android
```

Target-specific input emulation is tested separately from authoritative gameplay replay.
