# Roadmap

## Current verified foundation

- **TL00 CLOSED:** one Godot game, two real exported Web/Android emulator runtimes; 15/15 state, strict visual 3/3 and machine TL00 acceptance 9/9.
- **TL01 CLOSED:** Portability Doctor source/static diagnostics (PR #3, #5–#7).
- **TL02 CLOSED:** performance evidence authority and cohort/report contracts (PR #8–#11). Hardware performance is not certified.
- **TL03 DEFERRED:** experimental iOS preflight/export preserved but native runtime not verified.
- **TL04 CLOSED:** adapter SDK reference manifest, explicit Godot Web/Android dispatch and candidate conformance (PR #17–#19).
- **TL05-P0 CLOSED:** read-only in-repository Godot project adoption preflight and source coupling audit (PR #21), not an independent-game runtime proof.
- **TL05-P1/P2 PAUSED / BACKLOG:** independently running a second Godot game remains an unfulfilled validation, not an active prerequisite for Web-native adoption.

## Architecture boundary — accepted design, unimplemented routes

Five [architecture decision records](adr/README.md) lock product direction, independent source/runtime/package identities, authoritative gameplay semantics, evidence/release gates and external-project isolation. One original Three.js/Android WebView runtime-preserving reference is now implemented and CI verified; the ADRs do **not** constitute support for arbitrary Babylon.js/Three.js projects, Play-approved/store-ready release submissions, or an ONNX-like game IR. A narrow original Three.js API36 Release AAB and extracted APK emulator path is now implemented/CI verified (WF03-P0/P1).

## Prioritized Web-first route

1. **WF01-P0 CLOSED — Web-native game & interactive development QA.** Original Three.js Signal Garden game, dev server and observed Chromium replay evidence merged PR #24. Exact-head CI #38285851400 and final main #38286257646 both 7/7 PASS; Web-native gameplay 10 snapshots, 3 screenshot checkpoints, 3/3 collection victory. Godot TL00 gates unchanged. This is proof for **one game**, not all Web-native libraries.
2. **WF02-P0 CLOSED — Android Debug APK using runtime preservation.** Original Three.js Signal Garden offline WebView APK installed and replayed on Android emulator, `WP001–WP007` PASS for per-game source/Replay/state/HUD-image evidence. CI PR #26 and strict QA fix PR #27, post-merge main #38297831598 8/8 PASS. **WF02-P1 CLOSED for the reference/emulator:** the installed original APK passes 3 real ADB taps, collected-state retention through HOME/pause/resume and 5 raw PNG screenshot checks, same-source/host APK identity and 21 assertion instances. [PR #29](https://github.com/ictseoyoungmin/talarion/pull/29), exact-head CI #38303167847 8/8 PASS; original P0 and legacy Godot gates unchanged. No hardware performance, process-death persistence, orientation-change or Play AAB claim.
3. **WF03-P0/P1 CLOSED; P2 NEXT — Release AAB and Play readiness.** Independent signed API36 AAB with external disposable CI signer, bundletool validation, actual extracted Release APK and Android emulator original game state/touch/HOME plus browser parity. PR #30/#31 merged; exact-head and post-merge CI both 9/9 PASS for P1. [P1 evidence](wf03-p1.md). Production upload-key custody, Play Console compliance/submission, physical devices and Play approval remain unverified [P2](wf03-p2.md).
4. **WF04 RESEARCH — Cross-engine portable subset.** Tested limited behavior semantics across providers; do not require IR for WF01–03.
5. **TL05-P1/P2 BACKLOG:** independent Godot-game adoption remains valuable after the highest Web-native developer workflow risk is addressed.

## Gate discipline

Android `debug APK`, `release AAB` and `Google Play published` are three different statuses. WebView and native host are also distinct even if both produce an APK/AAB. The separately reviewed [physical-device certification](release-certification.md) applies only to claims about actual hardware/device-class reliability, not baseline CI. Do not upgrade statuses from declarative adapter manifests or fixture comparisons.

## Target architecture (not an implemented DAG)

~~~text
Developer-owned source (Babylon / Three / 2D / Godot)
                       |
              capability inspection
                       |
               source/runtime provider
             +---------+------------+
             |                      |
         Browser                 Android
             |               +------+------+
       Web runtime         WebView     Godot native
             |               |             |
         Web bundle       APK/AAB      APK/AAB (planned release)
             +---------------+-------------+
                             |
                    game-specific evidence
                             |
                build / runtime / parity /
                performance / release gates
~~~

No new engine, cloud farm, hosted SaaS, physical Android device or Apple subscription is required merely to develop and validate the existing reference toolchain.
