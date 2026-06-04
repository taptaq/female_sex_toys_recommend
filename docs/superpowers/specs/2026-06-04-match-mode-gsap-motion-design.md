# Match Mode GSAP Motion Design

## Goal

Make the Match Mode page feel more like an operable Luna star dial by moving the page entrance and mode switching polish into GSAP.

## Approved Direction

- Use GSAP for the Match Mode page entrance: back button, heading, orbit rings, mode planets, Luna, panel, and CTA enter in a staged sequence.
- Use GSAP for active mode switching polish: the selected planet image gets a small focus pulse, its aura glows briefly, Luna nudges with the active mode, and the selected panel text refreshes softly.
- Keep the existing CSS launch warp/iris/speedline route handoff mostly intact for this pass.

## Scope

- `src/pages/MatchModePage.tsx`: add GSAP context/effects and existing performance motion helpers.
- `src/pages/MatchModePage.test.tsx`: assert the GSAP motion contract.
- `src/index.css`: keep existing CSS route/launch visuals; only add or remove CSS if needed to prevent animation conflicts.

## Constraints

- No copy changes.
- No route changes.
- Respect reduced motion and page visibility.
- Avoid moving the orbit slot layout out of CSS in this pass.
