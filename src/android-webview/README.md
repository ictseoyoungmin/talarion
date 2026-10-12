# Android WebView Host

The dedicated host is a minimal Android Activity that loads **the original** Web-native game source and pinned Three.js modules from offline APK assets.

- Virtual HTTPS origin: `https://appassets.androidplatform.net/`, intercepted from packaged assets; no external game URL or Android JavaScript bridge.
- JavaScript enabled only for the self-contained packaged game. External navigation and resource requests rejected. Mixed content, `file://` and `content://` access disabled. No Android INTERNET permission.
- Console evidence forwarded to logcat as `TalarionGame` (no gameplay logic duplication in Java).
- Normal launch: interactive touch game. Explicit `--ez talarion_replay true`: deterministic replay for emulator CI.
- Uses SDK `aapt2`, `javac`, `d8`, `jar`, `zipalign`, `apksigner` without a Gradle wrapper or third-party Android runtime dependencies.

This is a constrained first-party WebView host, **not** an Android native renderer. A separate API36 release AAB build/verify candidate lives in release.mjs (WF03); it requires external signing files and pinned bundletool. Passing that build never implies Google Play approval, source translation, Android hardware certification or generic project adoption.
