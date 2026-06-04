# Home Luna Starmap Entry Design

## Goal

Make the Female MVP home hero entrance feel less plain while keeping the calm, feminine Luna tone.

## Approved Direction

Use a soft discovery sequence:

- The orbit path draws in first with a light glassy scan feel.
- Four planets appear one by one with a small `pop + glow`, as if Luna has found them on the star map.
- Luna enters after the planets start lighting up, floating up gently rather than simply fading in.
- Planet labels appear last with a quieter delay.
- After the intro, GSAP continues the low-frequency idle motion already used by Luna and the planets.

## Scope

Modify only the home hero animation contract:

- `src/pages/HomePage.tsx`: adjust the GSAP timeline timing, easing, and staged planet/Luna reveal.
- `src/index.css`: add a restrained scan/glow visual detail for the star map if needed, without adding new bitmap assets.
- `src/pages/HomePage.test.tsx`: update source-level assertions for the stronger entry sequence.

## Constraints

- No copy or route changes.
- No new dependencies.
- Respect `prefers-reduced-motion` and page visibility through the existing motion helpers.
- Avoid CSS infinite transform animations on homepage Luna and planet wrappers; GSAP remains the owner of those transforms.
