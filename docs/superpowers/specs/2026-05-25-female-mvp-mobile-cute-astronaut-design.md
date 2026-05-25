# Female-Only Mobile MVP Cute Astronaut Design

Date: 2026-05-25

## Goal

Turn the current broad intimate gear recommender into a lightweight mobile-first MVP for women choosing personal pleasure products.

The MVP should feel focused, soft, friendly, and lightly playful. The user should see one clear path: start a short match, answer a few low-pressure questions, receive a recommendation direction, and save or adjust the result.

This phase uses product-level hiding instead of physical deletion. Existing heavy modules remain in the repository, but they no longer compete with the MVP flow in the main app.

## Confirmed Direction

- Scope choice: product-level hiding, not broad code deletion.
- Audience: women-first product recommendation.
- Primary device: mobile.
- Visual style: cream pink, soft white, pale blue star accents, and a cute astronaut IP.
- Animation: use GSAP for focused, lightweight motion.
- MVP default: simple, warm, and not cluttered.

## Product Scope

### In MVP

- Mobile-first home screen.
- Short female-focused matching quiz.
- Matching/loading transition with cute astronaut and star particle motion.
- Results page focused on one main recommendation direction and a small number of alternatives.
- Favorite or local save behavior for products/results if already available with low implementation risk.
- Basic result adjustment actions, such as quieter, lower budget, or more beginner-friendly, if already supported by the current result flow.

### Hidden From Main MVP Surface

These modules stay in code but disappear from the default user-facing flow:

- equipment library as a primary navigation entry
- knowledge nebula as a primary navigation entry
- body persona test
- saved profile archive entry
- login prompts unless required by a retained save feature
- theme switcher
- male, couples, and unisex browse/filter pathways
- debug, scraper, and database maintenance scripts from everyday MVP usage documentation

If a hidden page is still reachable by a direct URL during this phase, it should not be linked from the MVP UI. A later cleanup pass may remove or archive these modules after the MVP direction is validated.

## UX Flow

### Home

Home is a mobile-first app screen, not a landing page. It should open directly on the matching experience.

Primary elements:

- cute astronaut IP signal in the first viewport
- one clear primary CTA: start matching
- very short trust copy about privacy, beginner-friendliness, and recommendation clarity
- soft indication that the experience takes only a few minutes

No competing homepage buttons for library, knowledge nebula, profile archive, or theme switching.

### Quiz

The quiz should feel like a gentle chat with a small space companion.

Question set should prioritize:

- beginner or experienced user
- external or internal preference, with careful language
- strength comfort level
- quiet/privacy needs
- waterproof/cleaning importance
- budget
- portability or discreet storage

The MVP should not ask male-specific, partner-device-specific, or broad couples-route questions. If existing branching includes those paths, the female MVP mode should avoid presenting them.

### Matching

The matching screen should use the astronaut IP as a tiny ritual:

- astronaut floating or inspecting stars
- small star particles drifting upward
- friendly short loading lines

This should be charming and quick, not a long cinematic.

### Results

Results should help the user decide, not explore the whole system.

Top hierarchy:

- main recommendation direction
- why it fits
- what to watch out for
- two or three next-step checks before buying
- small set of alternatives
- favorite/save action if retained
- lightweight adjustment buttons

Secondary education should be inline and brief. Do not send users to knowledge nebula from the MVP result surface.

## Visual Design

### Palette

Use a light mobile palette:

- background: warm white and soft blush
- primary: strawberry pink
- secondary: pale sky blue
- support: soft lavender only as a minor accent
- text: warm charcoal instead of slate-on-dark
- surfaces: white or translucent milk panels

Avoid returning to the existing deep-space dark theme as the default. Avoid making the design dominated by purple.

### Components

- Use rounded, compact mobile cards for quiz options and result products.
- Keep cards at moderate radius; avoid nested cards.
- Use icon buttons where actions are familiar.
- Use pill controls for result tuning.
- Use bottom-safe spacing for mobile CTAs.
- Keep text short enough for small screens.

### Astronaut IP

The astronaut is a mascot-like guide, not a complex character system.

Initial implementation can be code-native:

- CSS/HTML astronaut illustration or simple local SVG component
- helmet, tiny face, backpack, and star trail
- reusable in home, matching, and empty states

Do not depend on external image generation for the first implementation.

## Motion Design With GSAP

Add `gsap` as the dedicated animation dependency.

Use GSAP in a small animation layer rather than scattering imperative timelines through page code.

Recommended motion:

- home entrance: astronaut float, CTA rise, star particles drift
- quiz transition: outgoing card slides/fades, incoming card pops softly
- option tap: tiny scale response and star sparkle
- matching: looping astronaut float and orbiting dots
- results reveal: recommendation card rises, score/details stagger in

Accessibility and performance:

- respect `prefers-reduced-motion`
- keep animations short
- avoid heavy continuous animations on large DOM trees
- clean up timelines on unmount
- mobile frame rate is more important than decorative density

## Technical Design

### MVP Mode

Introduce a simple product-mode switch in app code, defaulting to female MVP.

The switch should allow:

- hiding non-MVP home entries
- defaulting product audience to female
- suppressing male/couples/unisex quiz branches
- simplifying library/profile/knowledge navigation from the main flow
- keeping hidden modules available for later reactivation

The exact implementation can be a small module such as `src/lib/app-mode.ts` with constants rather than environment variables, unless the existing codebase already has a better feature-flag pattern.

### Routing

The default route set should still compile with existing route components, but the main UI should only navigate through the MVP path.

Do not physically delete route components in this phase.

### Data And Recommendation

Recommendation logic should filter candidate products to female audience by default.

If products are marked `unisex` but clearly support female use, they may be included only when the existing classifier or product fields support that safely. Male-only products must not appear in MVP recommendations or browse surfaces.

### Styling

Create a new default theme direction rather than trying to override every old dark-space class in place.

Good implementation targets:

- CSS variables in `src/index.css`
- focused class additions in page components
- reuse existing Tailwind patterns where practical

Keep old theme code where needed, but MVP screens should not visually depend on the dark cosmos theme.

### Dependency

Add `gsap` to dependencies. Existing `motion` usage may remain until replaced naturally. This phase does not require a full motion-library migration.

## Testing And Verification

Required checks:

- `npm run lint`
- relevant page/component tests after edits
- mobile viewport manual or browser verification for home, quiz, matching, and results
- verify no MVP-visible entry links to knowledge nebula, body persona, profile archive, or primary library
- verify male-only products do not surface in MVP recommendations
- verify reduced-motion users do not receive continuous GSAP animations

## Out Of Scope

- physical deletion of hidden modules
- removing scraper directories
- removing DB cleanup/backfill utilities
- redesigning the full data model
- rebuilding the recommender algorithm from scratch
- implementing a paid body persona flow
- adding a web landing page
- creating a complete illustration asset pipeline

## Success Criteria

- On mobile, the first screen clearly looks like a women-first cute astronaut matching app.
- A new user has one obvious action: start matching.
- Main flow no longer feels like a database, knowledge hub, or multi-module platform.
- The app defaults to female-focused recommendations.
- Animation makes the flow feel alive without making it slower or more complex.
- Existing heavy code is preserved for later, but no longer dominates the MVP user experience.
