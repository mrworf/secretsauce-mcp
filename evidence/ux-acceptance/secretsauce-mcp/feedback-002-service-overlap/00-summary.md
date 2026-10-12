# UX Visual Audit Summary

> Audit: FEEDBACK-002-SERVICE-OVERLAP
> Generated: 2026-10-12T15:24:13.865462+00:00
> Product/build: SecretSauce 0fc959f5f13b5fb4751788910fdb4c48fcdf442c; unchanged delivered M21 runtime
> Canonical UX: product/ux/manifest.yaml, approved web-console-ux-2
> Harness: capture.mjs SHA-256 recorded in manifest
> Environment: isolated Docker disposable fixture, https://console.example.org on ephemeral loopback port
> Surfaces: responsive web, Owner service creation
> Browser evidence: Playwright 1.64.0, Chromium 151.0.7922.34 in pinned Playwright v1.62.1 image
> Reproduction command: see manifest execution.command (run from repository root with existing built dist)

Overall status: MATERIAL_FINDINGS

Reproduced overlapping progress list markers in Details, Destination and Authentication at 1280×900 and 320×900. All six screenshots were visually inspected. The initial Add service action alone reproduces it, without entering any service data. Number markers visibly collide with adjacent labels even though document width fits the viewport.

Scope: PO-FB-018 / REC-009 only. Capture coverage 6/6; journey exercise 1/1; desktop 3/3; narrow 3/3. This is bounded evidence, not whole-wizard conformance or release approval. No live local-review instance, user data, real emails or downstream requests used. Parent workflow owns the transaction; no code or authority changed.

Runtime limitation: existing installed Playwright package 1.64.0 was explicitly paired with the installed pinned v1.62.1 container Chromium executable, following parent authorization to reuse the existing compatible harness. This differs from the skill's preferred matching image/package versions. All six captures and keyboard transitions succeeded. Evidence establishes the visible collision on the recorded browser only; no Firefox or other-browser claim. No mocked/intercepted response state. Full accessibility, advanced destinations and remaining wizard stages were outside this narrow observation scope.
