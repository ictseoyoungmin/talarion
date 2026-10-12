# Release Certification — Physical Device Compatibility and Performance

## Purpose

Hardware certification is a **separate, optional product/release gate**. It becomes required only when a release explicitly claims support for a named physical device or device class, sustained FPS, memory footprint, thermal/ battery behavior, or lifecycle reliability. It is not a prerequisite for TL00, TL01, CI usage, or merging validated infrastructure work.

## Explicit distinction

| Capability | TL00 acceptance | Release certification |
| --- | --- | --- |
| Exported Godot Web and Android (emulator) | Required | Prerequisite |
| Canonical replay state / screenshots / difference images | Required | Repeated on target device |
| Basic engine-observed FPS, frame/physics time, static memory | Diagnostic only | Measured and budget-graded on device |
| Physical hardware identification | Not required | Required |
| Sustained thermal, lifecycle and memory pressure | Not required | Required for applicable claims |
| Certification result | `talarion.tl00-acceptance/v1` | `talarion.hardware-certification/v1` |

## Certification contract

`assessHardwareCertification` is implemented as a separate pure function in `src/runtime/gates.mjs`. It fails closed unless:
- `talarion.android-device/v1` positively identifies a **non-emulator**;
- independently reviewed measurements are sourced from physical hardware and meet the declared device-class budget;
- lifecycle and compatibility checks pass.

An emulator may pass TL00 acceptance but must always fail hardware certification. No official Android device certification has been performed, and no hardware grade is currently claimed.

## Minimum future evidence

- device model, API, build fingerprint, GPU/driver, display refresh, benchmark environment and build/APK hash;
- same canonical replay and screenshot parity run as TL00;
- frame pacing/P10 FPS, tail latency, sustained memory and thermal envelope under realistic load;
- suspend/resume, app background/foreground, screen rotation/insets, touch input and process kill/restart;
- a declared budget and versioned review with explicit per-device decision;
- archived screenshots, JSON logs, reproduction instructions and owner sign-off.

This checklist specifies a future **release claim**, not a hidden acceptance requirement for ongoing development.
