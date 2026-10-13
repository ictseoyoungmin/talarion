# Next Slice — WF03-P1 Reliability Reopen (issue #33), then P2 Google Play Submission Preflight

## Accepted baseline

- **TL00–TL02 CLOSED:** Godot Ruins Lite exported Web/Android runner proof; state 15/15, strict visual 3/3 with declared 2% tile-error limit, TL00 acceptance 9/9; static Doctor and observational performance evidence.
- **TL03 DEFERRED:** experimental iOS code remains, with no native iOS runtime or signing certification.
- **TL04 CLOSED:** Godot adapter manifest, explicit dispatch, read-only candidate conformance.
- **TL05-P0 CLOSED:** non-destructive *read-only* in-repository Godot preflight and sample coupling inventory, PR #21; does not demonstrate independent gameplay.
- **TL05-P1 / P2 RESEQUENCED — NOT CLOSED:** independent second-Godot-game adoption proof remains valid work but is not the next product bottleneck; do not claim completed or delete its history.

## Design gate — accepted ADRs

[ADR-001–005](adr/README.md) specify the forward architecture: source-owned Web-first development; source/runtime/artifact independence; single game-state authority and optional limited IR; separate build/runtime/parity/store proof; isolated external projects and provenance-aware graph.

**ADR acceptance is not implementation evidence.** The existing Godot `talarion.config.json` stays v1. A separate `web-native dev/test` runner now exists for one Three.js reference project; no general-purpose Babylon.js adapter, verified Play-ready release AAB or cross-engine IR exists. The original Signal Garden Web-native game now has a constrained offline Android WebView Debug APK builder and emulator-tested replay/parity.

## New prioritized implementation slices

### WF01 — Browser-native playable reference and QA (P0 CLOSED)

- **WF01-P0 CLOSED:** original Three.js Signal Garden 3D game with an independent source manifest, interactive browser run and actual Playwright WebGL2 evidence, without Godot conversion. PR #24, exact-head CI #38285851400 and post-merge main CI #38286257646 both 7/7 PASS. [Implemented game & QA](wf01-p0.md).
- Integrate minimal adapter/runtime evidence: developer-owned source, semantic replay, authoritative game state, named screenshots, performance capture and explicit runtime capabilities. Do not make existing `talarion test web` silently accept unknown engines.
- Persist project-source/build/replay/runtime hashes and separate run outputs. Negative test untrusted projects, missing capabilities and invalid evidence.
- **Exit:** executable original browser game and independent runtime evidence **from that game**, plus unchanged Godot exported Web/Android CI and TL00 QA.

### WF02 — Runtime-preserving Android Debug APK (P0/P1 CLOSED)

- **WF02-P0 CLOSED:** independently built/installable offline Android WebView Debug APK hosting exactly the same Three.js source. Browser and emulator Replay each supply 10 authoritative snapshots, 3 PNG checkpoints, exact source/vendor/replay hashes and 3/3 victory HUD image assertions. Browser↔WebView `WP001–WP007` PASS, verified on PR #26 exact head CI #38293231318, after QA #4 mitigation PR #27 exact head CI #38297356791 and main CI #38297831598, each 8/8 PASS. [Implementation contract](wf02-p0.md).
- **WF02-P1 CLOSED (reference game/emulator):** `web-native android smoke` reinstalls the existing SHA-256 verified Debug APK; 3 real ADB taps change authoritative game positions [-3,-3] → [-2,-3] → [-1,-3] → [-1,-2], collecting beacon 1; HOME triggers Activity.pause and WebView visibility hidden, then resume without reload retains source state. Five raw Android captures, 21 passed check instances and provenance are recorded. [WF02-P1 QA contract](wf02-p1.md). PR #29 exact-head CI [#38303167847](https://github.com/ictseoyoungmin/talarion/actions/runs/38303167847) **8/8 PASS**, original P0 Replay and legacy Godot gates unchanged.
- **P1 exit satisfied for constrained reference/emulator:** the original actual Android game preserved gameplay state through HOME/resume. Not proven: orientation-change recovery, Android process death/persistence, real physical-device performance, all Android OEM skins or app-store release readiness.

### WF03 — Google Play Release AAB preflight (P0 CLOSED; P1 QA REOPENED; P2 QUEUED)

- **WF03-P0 CLOSED:** PR #30 merged main da721c34518c4772b23315964beb22b12dc8e9b2 with exact-head CI #38310730950 and main CI #38311126082 **9/9 SUCCESS**. The original Three.js source builds an isolated API36 signed AAB, independently validated with pinned bundletool/JAR cert, manifest, ABI applicability and source SHA-256. [Contract](wf03-p0.md).
- **WF03-P1 INITIAL PASS, THEN QA REOPENED (reference emulator):** PR #31 merged `9fa9a107a16aa17527eda1e9576743c02ab7473f` after [exact-head CI #38313382405](https://github.com/ictseoyoungmin/talarion/actions/runs/38313382405) and [post-merge main CI #38313902291](https://github.com/ictseoyoungmin/talarion/actions/runs/38313902291), both **9/9 SUCCESS**. Actual signed AAB → independently verified Release APK → real emulator run: 10 original state snapshots, 3 replay PNG, three trusted touch inputs and five raw lifecycle screenshots, HOME/resume state retained. Independent original-browser↔Release WP001–007 PASS. [Proof contract](wf03-p1.md). No physical-device/store approval.
- **WF03-P1 issue #33 BLOCKER:** After successful release APK CI, independently observed main CI #38314821761 lost the third trusted tap after HOME while portrait; first PR #34 orientation-only attempt #38315548405 also failed despite two landscape frames. Correct gate now requires observational trusted neutral canvas input acknowledgements and must pass repeated independent full CI before issue #33 closure; no blind movement retries.
- **WF03-P1 remaining QA #33:** [main CI #38358001270](https://github.com/ictseoyoungmin/talarion/actions/runs/38358001270) proved the new landscape+neutral WebView readiness checks worked for Release but legacy Debug still intermittently lost post-HOME button `click`. Original game now treats button `pointerdown` as authoritative and suppresses compatibility click double-moves; `CONTROL_ROUTE`/`WI019` independently assert all three physical movements. Keep P1 REOPENED until unchanged-head repeated full CI succeeds for **both** Debug and Release.
- **WF03-P2 QUEUED (not implemented):** [Google Play submission readiness boundary](wf03-p2.md), including user-controlled production upload-signing custody, Play App Signing enrollment, controlled package/version strategy, current policy and compliance checks, and actual Play Console acceptance separate from local CI. Physical-device QA remains an independent release-certification gate.
- Prefer current official policy at gate execution; version the policy snapshot. No embedded keys, no auto-publishing, no inferred Play approval.
- **Exit:** independently inspectable signed release AAB and a release-preflight report distinct from build/runtime pass; publication unverified until Play confirms.

### WF04 — Portable-subset feasibility (research, optional after WF01–03)

- Specify a tiny operator set only after behavior semantics are normative. Test the same gameplay in Web-native and a Godot implementation; compare source/state/event/visual evidence without assuming physics equivalence.
- **Exit:** either measured portable-conformance proof or an explicit limitation/rejection of the IR hypothesis. No general Three.js -> Godot conversion claim.

## Execution and scope guards

1. **Do not add code to implementation simply to satisfy accepted ADRs.** Deliver one visible, tested slice at a time; do not weaken Godot reference CI.
2. Keep TL05-P1 in the backlog rather than deleting it or falsely marking it complete; reassess its priority against WF01–03.
3. Fail closed for cross-project source mutation, symlink/staging collisions, malicious plugins, stale provenance and unsupported required capabilities.
4. QA issue [#4](https://github.com/ictseoyoungmin/talarion/issues/4) is mitigated by PR #27 with raw before/after review, explicit Godot Android immersive mode and fail-closed OS status-bar PNG detection; it **remains open for multi-run stability monitoring**. Do not weaken the 2% max-tile visual gate. Lockfile generation still needs real dependency resolution, not a fabricated offline lock.
5. Actual device-class FPS, thermal, memory and certification are separate from emulator CI; iOS is still deferred.
