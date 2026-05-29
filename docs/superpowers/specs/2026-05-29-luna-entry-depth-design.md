# Luna Entry Depth Design

## Goal

Make the Match Mode launch feel less flat by blending an active arc flight with a brief planet-center iris warp.

## Approved Direction

Use a B+C blend from the visual companion:

- Luna switches from the guide pose to the dive pose and follows a rising arc toward the active planet.
- Soft speed lines appear during the acceleration phase.
- Near impact, the planet center blooms into a white-blue iris/warp that briefly swallows Luna and adds depth.
- Keep the current 980ms route handoff so the interaction stays quick.

## Scope

Modify only the Match Mode launch visuals:

- `src/pages/MatchModePage.tsx`: add decorative launch-warp layers inside the orbit stage.
- `src/index.css`: add speedline, iris, planet brightness, and revised dive animations.
- `src/pages/MatchModePage.test.tsx`: lock the new visual contract.

## Constraints

- No copy changes.
- No new dependencies.
- Decorative layers must be `aria-hidden`.
- Existing reduced-motion/global motion-pause behavior should continue to suppress CSS animations.
