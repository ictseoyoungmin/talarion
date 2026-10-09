# Runtime Runner Contract

Runtime runners convert a target build plus canonical replay into comparable evidence.

## Inputs

Every runner receives:

```text
target
build artifact
canonical replay artifact
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
      {
        "checkpoint": "interaction",
        "tick": 420,
        "file": "artifacts/run/web/interaction.png"
      }
    ],
    "performance": null
  },
  "warnings": []
}
```

A successful process exit without evidence is not a successful runner result.

## Shared runtime protocol

The Godot runtime emits plain-text markers that both runner implementations parse:

```text
TALARION_REPLAY_READY {...}
TALARION_STATE {...}
TALARION_EVENT {...}
TALARION_CAPTURE {...}
TALARION_REPLAY_FINISHED 600
```

`src/runtime/evidence.mjs` is the shared parser. Browser console and Android logcat therefore feed the same evidence path.

## Web runner

Implementation: `src/runners/web.mjs`.

Backend: Playwright + Chromium.

Responsibilities:

1. serve the exported Web build from a local HTTP server;
2. launch it in headless Chromium;
3. collect the Talarion protocol from browser console output;
4. write authoritative state JSONL;
5. capture named screenshot checkpoints;
6. emit `talarion.runner-result/v1`.

The exported Web runner passed TL00-R1 runtime state parity. TL00-R2 additionally requires real checkpoint image parity.

## Android runner

Implementation: `src/runners/android.mjs`.

Backend: ADB + Godot runtime protocol.

Responsibilities:

1. discover an authorized device or emulator;
2. install the exported APK;
3. clear logcat and launch the package;
4. collect the Talarion protocol from logcat;
5. write authoritative state JSONL;
6. emit `talarion.runner-result/v1`.

Android checkpoint screenshot capture is implemented; the visual CI gate validates it during TL00-R2. Performance telemetry and physical-device testing remain TL00-R3.

## Shared semantics

Web and Android runners do not implement different gameplay semantics.

```text
Canonical replay
      ↓
TalarionBridge
   /       \
 Web     Android
```

The Godot bridge holds replay ticks after each checkpoint so capture can observe a stable game state, and the Web runner waits for the compositor. The visual report rejects missing images, incorrect ticks and blank screens. This does not guarantee pixel-exact cross-GPU rendering.

Raw keyboard, pointer, touch, and controller emulation belong to a separate end-to-end device-input layer. They do not define authoritative gameplay parity.
