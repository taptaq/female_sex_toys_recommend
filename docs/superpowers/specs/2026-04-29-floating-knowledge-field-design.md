# Floating Knowledge Field Design

## Goal

Replace the current large loading knowledge card presentation with medium-density floating short-sentence capsules that feel like space debris around the loading experience.

This applies to both current loading surfaces:

- `LoadingPage`, used during app/product-library loading.
- `MatchingPage`, used after quiz completion while recommendations are being matched.

## User Experience

Knowledge should become ambient page texture instead of a centered card. Each item appears as a small translucent capsule containing a short title. The capsules drift around the main loading scene with subtle motion, depth, and staggered entrance timing.

The center of each page remains readable:

- `LoadingPage` keeps the spinner, title, progress line, retry button, and connection copy visually clear.
- `MatchingPage` keeps the radar, matching status, and flashing selected tags visually clear.
- `MatchingPage` may allow a few capsules near the central tag area edge, but not on top of core text.

The capsules are non-interactive and do not block pointer input.

## Visual Direction

Use a shared "space debris" language:

- 7-10 capsules on desktop.
- 4-6 capsules on mobile.
- Two depth layers: dimmer, slower far-field capsules and brighter, slightly more active near-field capsules.
- Soft glass styling, small borders, restrained glow, and slight rotation.
- Short readable phrases rather than full explanatory cards.

The existing dark sci-fi visual language should remain intact. The new layer should feel like information fragments orbiting the scene, not a separate content panel.

## Animation

Capsule motion should be ambient:

- Subtle drift.
- Gentle breathing opacity.
- Slight rotation.
- Staggered fade-in.
- No large cross-screen travel.

`LoadingPage` should feel slower and calmer. `MatchingPage` can be slightly more active, matching the radar and tag-flash energy.

Respect reduced motion by disabling drift-heavy animation and using static placement with opacity only.

## Content Source

Reuse the existing loading facts pipeline:

- `LoadingPage` continues to call `getLoadingFunFacts("loading", ...)`.
- `MatchingPage` continues to call `getLoadingFunFacts("matching", ...)` with quiz tags for prioritization.

Only `fact.title` is displayed in capsules. `fact.description` is no longer shown on these two loading surfaces.

The existing `LoadingFunFacts` card component can remain in the codebase for future reuse, but it should no longer be rendered by `LoadingPage` or `MatchingPage`.

## Proposed Architecture

Add a shared floating layer component, tentatively named `FloatingKnowledgeField`.

Responsibilities:

- Accept selected facts and a surface variant.
- Select a responsive count of facts for the current surface.
- Map facts into deterministic placement slots.
- Render non-interactive animated capsules.

Keep placement data close to the component. Avoid runtime collision detection; use fixed responsive slots with conservative center-safe regions.

The component should expose a small API:

- `facts`
- `variant`, such as `"loading"` or `"matching"`
- optional `className`

## Styling

Add CSS classes in `src/index.css` for:

- the fixed/absolute full-page field wrapper
- capsule base visuals
- near/far layer differences
- drift keyframes
- reduced-motion behavior
- mobile-specific density and placement refinements

Avoid making the layer responsible for page layout. It should sit behind or around existing main content using `position: absolute`, `inset: 0`, and `pointer-events: none`.

## Testing

Add focused tests for pure layout/data behavior rather than animation pixels:

- The layout helper returns desktop and mobile capsule counts within the intended ranges.
- The matching variant uses matching-safe slots.
- The loading variant uses loading-safe slots.
- Empty fact arrays produce no capsules.
- Fact order remains deterministic after slicing.

Run existing relevant tests plus type checking/build verification after implementation.

## Out Of Scope

- Rewriting the recommendation logic.
- Changing the fact data copy.
- Adding click interactions to knowledge capsules.
- Replacing the radar or loading spinner.
- Removing the existing `LoadingFunFacts` component entirely.
