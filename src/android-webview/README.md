# Android WebView Host

The dedicated host is a minimal Android Activity that loads **the original** Web-native game source and pinned Three.js modules from offline APK assets.

- Virtual HTTPS origin: `https://appassets.androidplatform.net/`, intercepted from packaged assets; no external game URL or Android JavaScript bridge.
- JavaScript enabled only for the self-contained packaged game. External navigation and resource requests rejected. Mixed content, `file://` and `content://` access disabled. No Android INTERNET permission.
- Console evidence forwarded to logcat as `TalarionGame` (no gameplay logic duplication in Java).
- Normal launch: interactive touch game. Explicit `--ez talarion_replay true`: deterministic replay for emulator CI.
- Uses SDK `aapt2`, `javac`, `d8`, `jar`, `zipalign`, `apksigner` without a Gradle wrapper or third-party Android runtime dependencies.

This is a constrained first-party WebView host, **not** an Android native renderer. No signed Google Play release AAB, cloud publishing, source translation, Android hardware certification or generic external project adoption is implied by its existence.
