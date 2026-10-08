# Roadmap

## TL00 — One Game, Two Runtimes

Web ↔ Android deterministic replay and parity evidence.

## TL01 — Portability Doctor

Expand static and project checks across platform APIs, renderer capabilities, lifecycle behavior, and asset/mobile budgets.

## TL02 — Performance Budget

Add target profiles and regressions for FPS, frame time, memory, draw calls, texture pressure, and related device constraints.

## TL03 — iOS Target

Extend the same replay, evidence, and parity contract to iOS without introducing a separate gameplay implementation.

## TL04 — Adapter SDK

Stabilize the engine/backend contract and enable additional integrations to implement Talarion capabilities.

## Long-term shape

```text
              Talarion
                 |
        +--------+--------+
        |                 |
Portability Doctor   Parity Test
        \                 /
         +------Build-----+
                Graph
         /        |        \
       Web     Android     iOS
```

The roadmap prioritizes contract quality and reproducible evidence before backend breadth.
