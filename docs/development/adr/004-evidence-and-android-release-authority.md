# ADR-004 — Evidence Authority and Android Release

Status: **Accepted (design only)**  
Date: 2026-10-13

## Decision

Treat **build, execution, parity, performance, release-readiness and store-publication as independent gates**. A static manifest cannot certify runtime behavior; an emulator cannot certify real hardware; a passing AAB build cannot certify Play policy compliance or actual publication.

| Gate | Evidence required | Forbidden inference |
| --- | --- | --- |
| `source-preflight` | Valid project/capability declarations and inspected files | No actual execution or portability proof |
| `build-integrity` | Exact build command, toolchain identity, artifact SHA-256 and validated package structure | Build success is not runtime success |
| `runtime` | Exported/installed artifact observed on actual named runner | No equivalent gameplay or visual proof |
| `semantic-parity` | Same replay ID/hash with runtime-generated authoritative state/events and explicit thresholds | No parity from repository reference fixtures |
| `visual` | Named runtime screenshots, independent visual comparison and image provenance | No fidelity guarantee for scenes not checked |
| `performance` | Measured environment, sample/window/budgets and device class | No thermal/FPS certification from an emulator |
| `release-preflight` | Package/manifest/signing/API/ABI/install test and current Play policy checklist | Not a guarantee of store acceptance |
| `store-published` | Independent Play Console approval/publication evidence | Cannot be self-certified by a build tool |

Every report binds **source tree/ref, source asset hashes, replay hash, dependency/toolchain versions, provider identity, artifact hash, target package ID, runner environment and evidence paths**. An absent identity yields `unknown` or a blocked gate, not an assumed PASS. Preserve raw before/after screenshots and separately review QA issue #4; the existing Ruins Lite CI is a reference regression, not other games' release evidence.

## Android delivery contracts

**Debug APK:** designed for emulator/device install and quick QA; must have a distinct debug signing identity and versioned application ID policy. It is not inherently store-ready.

**Release AAB:** separate release build, appropriate Gradle/Godot/export tooling, upload signing provenance and reproducible package inspection. The Play upload artifact is an AAB; optional APKs for validation must be derived via the appropriate bundle tooling. Do not publish private signing keys, keystore passwords or Play credentials in the repository, logs, reports or artifacts.

Both an embedded Android WebView game and a Godot-native Android game may produce Android packages, but retain **runtime-class** identity and distinct performance expectations. WebView release path must account for offline assets and safe local origin serving, restricted JavaScript/native messaging, explicit permissions, navigation/URL allowlists, deep links, storage and third-party content constraints. Native paths must assess ABI, engine export templates, app lifecycle, orientation/insets and resource use.

Release readiness must check **currently effective** Google Play requirements at execution/review time, not a forever-hardcoded API level or test-account assumption. Maintain versioned policy evidence (policy snapshot date, required target SDK, 64-bit/native lib alignment where applicable, package/version uniqueness, app privacy/data-safety obligations, testing eligibility and store declarations). Status is `unknown` until independently checked against current official policy.

## Security and publication boundary

- Key custody is user-controlled. Integrate OS secrets/CI secret stores only by explicit opt-in; redact output and enforce least privilege.
- Builds or plugins from untrusted external projects do not execute during static inspection. Actual execution requires explicit user authorization and process/workspace isolation.
- APK/AAB generation is a local build action; any Play upload/release action requires independent explicit authorization, credential scope and audit trail.
- Do not conflate `release-preflight: pass` and `published`; publication belongs to Google Play review, not to Talarion.
- Physical-device certification remains the separately reviewed [release-certification](../release-certification.md) gate.

## Minimal acceptance before marketing a Play path

At least one genuine independent Web-native game passes runtime-preserving Android debug APK install/replay; a separate release AAB is built, structurally inspected, safely signed, validated using bundle tooling and reviewed for current Play requirements. Neither artifact alone proves actual Play listing.

References: [ADR-001](001-web-first-product-scope.md), [ADR-005](005-project-isolation-and-build-graph.md).
