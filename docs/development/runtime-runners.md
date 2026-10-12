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
        "tick": 410,
        "file": "artifacts/run/web/interaction.png"
      }
    ],
    "performance": {
      "schema": "talarion.performance/v1",
      "target": "web",
      "ok": true,
      "sampleCount": 10,
      "fpsMedian": 60,
      "peakMemoryBytes": 83886080
    }
  },
  "warnings": []
}
```

This is a **schematic example** with illustrative performance numbers, not captured runtime evidence or a certification. Real runner manifests include additional performance/provenance details and the canonical replay hash. A successful process exit without evidence is not a successful runner result.

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

The exported Web runner and Android emulator runner have **completed** TL00: 15/15 authoritative state, 3/3 strict spatial visual checkpoints and TL00 9/9 acceptance. No physical-device performance is certified.

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

Android checkpoint screenshot capture is implemented and is verified alongside the Web screenshots in the closed TL00 visual gate. Observational telemetry is collected, while physical-device certification is a separate optional release gate.

## Shared semantics

Web and Android runners do not implement different gameplay semantics.

```text
Canonical replay
      ↓
TalarionBridge
   /       \
 Web     Android
```

The Godot bridge holds replay ticks after each checkpoint so capture can observe a stable game state. Following [QA #4](https://github.com/ictseoyoungmin/talarion/issues/4), `main.gd` defers `TALARION_CAPTURE` until two `RenderingServer.frame_post_draw` signals have completed; Web also waits for compositor presentation. The visual report rejects missing images, incorrect ticks, blank screens and out-of-tolerance regional differences. Raw before/after screenshot review remains tracked in QA #4; this does not guarantee pixel-exact cross-GPU rendering.

Raw keyboard, pointer, touch, and controller emulation belong to a separate end-to-end device-input layer. They do not define authoritative gameplay parity.

## TL00-R3 observational performance evidence

Godot emits `TALARION_PERF` once per replay second, including tick, FPS, process milliseconds, physics milliseconds, and static memory bytes. These samples **do not participate in state parity** and must not be treated as deterministic simulation values.

Both runners save `performance.jsonl` and expose `evidence.performance` with schema `talarion.performance/v1`. The summary records sample count, P10/median FPS, P95 process/physics time, peak memory and target-FPS metadata. Invalid or absent samples fail the instrumentation smoke gate. The performance target value itself does **not** mean the measured run meets that target.

TL00-R3 closed on actual exported Web/Android emulator telemetry and reproducible evidence. Physical-device measurements, real GPU identity, thermal behavior and lifecycle compatibility are required **only** for named hardware/device-class release claims under [Release Certification](release-certification.md). CI headless emulators use virtualized graphics and cannot certify mobile hardware performance.

## Hardware provenance

The Android runner saves `device.json` and `talarion.android-device/v1` metadata: model, manufacturer, API, build fingerprint, hardware, GLES renderer and emulator detection. Raw ADB serial numbers and personal Android identifiers are not included in public artifacts. Both Web and Android include the canonical replay SHA-256, and parity rejects missing/mismatched hashes; Android additionally records the APK SHA-256.

The API 30 AOSP / ANGLE SwiftShader runner is an emulator (`isEmulator=true`). Hardware performance certification remains an external physical-device QA requirement.
