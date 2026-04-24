# Recommendation Results Enhancement Design

## Goal

Enhance the current recommendation results module so the user sees more than the top 3 products.

The upgraded results experience should provide:

- the existing `Top 3` main recommendations
- a separate `backup candidates` section with additional product cards outside the top 3
- a more useful `shopping guidance` section with short, decision-oriented advice
- layouts that work cleanly on both mobile and desktop

The feature should improve decision quality without weakening the current ranking pipeline.

## User Need

The current results page tells the user which 3 products are the best match, but it does not help enough with:

- what else is worth considering
- how backup options differ from the top 3
- what trade-offs matter most for the current answer set

The user explicitly wants:

- a separate block of backup product cards outside the top 3
- meaningful toy-selection guidance, not generic filler
- mobile and desktop adaptation as a baseline requirement

## Confirmed Product Direction

Agreed direction from discussion:

- keep the existing top 3 recommendation flow
- add a separate backup-card section under the top 3
- use `rule-selected cards + AI-written guidance`
- make the feature responsive for both mobile and PC

This means the enhancement is additive, not a rewrite of the ranking core.

## Chosen Approach

Recommended approach: `Structured candidate selection with AI explanation layer`

### Why this approach

- the current structured ranking remains the source of truth for stability
- backup cards stay explainable and controllable
- AI is used only where it adds value: short explanations and shopping guidance
- the page still degrades well if AI output is missing or malformed

### Alternatives considered

- pure rule-based backup cards and rule-written guidance
  - stable, but less persuasive and less tailored
- AI chooses all cards and all advice
  - flexible, but too risky and inconsistent with the current ranking architecture

## Scope

The enhancement will cover:

- result-generation logic in `src/App.tsx`
- result rendering in `src/pages/ResultsPage.tsx`
- new derived result payload for backup candidates and shopping guidance
- fallback logic when AI explanations fail
- responsive layout behavior for mobile and desktop
- focused tests for backup candidate selection and rendering branches where practical

Out of scope:

- changing the underlying quiz questions
- changing the existing top-3 ranking algorithm itself
- introducing a new backend endpoint
- redesigning the whole visual identity of the app

## Result Page Information Architecture

The page should be organized into three layers:

### 1. Shopping Guidance

This section remains near the top of the results page.

It should evolve from a simple “relax your filters” message block into a mixed guidance section that can contain:

- decision hints
- trade-off hints
- filter relaxation suggestions when matching is narrow

Guidance should stay short:

- 3 to 5 items
- one sentence each
- no long paragraphs

Examples of useful guidance:

- what the strongest limiting factor was in this recommendation run
- whether the user is currently optimizing more for noise, budget, or discretion
- which condition is most worth relaxing if they want more options
- what practical difference separates the top 3 from the backup set

### 2. Top 3 Main Recommendations

This section should preserve the current hierarchy:

- one featured top-1 card
- two smaller supporting top-2/top-3 cards

The current visual emphasis should remain intact so the backup section does not dilute the main answer.

### 3. Backup Candidates

This is a new independent section below the top 3.

Suggested section title direction:

- `如果你想换一种侧重点`
- `也值得看的备选装备`

This section should present 2 backup cards by default, with room for 3 if the candidate pool is strong enough.

Each backup card should answer:

- what this product is
- why it did not become top 3
- in what direction it may be a better fit

## Backup Candidate Selection Strategy

Backup candidates must not be selected by AI directly.

### Source pool

- start from the structured ranked candidate list
- exclude the final top 3 products
- search the remaining high-ranked items for differentiated options

### Selection goal

The backup set should represent different trade-off directions rather than simply “rank 4, 5, 6”.

### Priority dimensions

Candidate tags should be derived from the strongest distinguishing characteristic, such as:

- `更静音`
- `更省预算`
- `更适合入门`
- `更高防水`
- `更低存在感`
- `更适合情侣 / 共享`

### Selection flow

1. Start with the structured ranking results after top 3 are finalized.
2. Remove products already used in top 3.
3. Try to select one strong representative per differentiation direction.
4. Deduplicate by product id and by repeated direction label.
5. If differentiated candidates are insufficient, fill remaining slots from the next-best ranked products.

This keeps the section useful instead of repetitive.

## AI Responsibilities

AI should not decide which products appear in the backup section.

AI should only generate explanation content.

### For top 3

Keep the current top-3 reason generation flow.

### For backup cards

Generate one short sentence per backup card describing:

- what kind of user it may suit better
- what trade-off it represents compared with the top 3

These explanations should be concise and concrete, not marketing-heavy.

### For shopping guidance

Generate 3 to 5 short advice items using:

- user answers
- the final top 3
- the selected backup candidates
- known hard constraints or near-misses from structured ranking

The generated content should focus on decision utility, not generic product praise.

## Fallback Strategy

If AI output fails, the page must still feel complete.

### Backup cards fallback

Cards still render using rule-selected products.

Each backup card gets a local templated explanation based on its strongest trait, for example:

- quieter than the current top match
- easier on budget than the lead recommendation
- a more approachable entry point for first-time users

### Shopping guidance fallback

Generate local short tips from current answer constraints, using the same signals already available in ranking:

- budget pressure
- low-noise threshold
- disguise preference
- gender filtering
- candidate scarcity

### Empty-state behavior

- if no strong backup candidates exist, hide the backup section entirely
- if guidance cannot be generated, hide the block rather than showing filler

## Responsive Layout Requirements

Responsive behavior is a first-class requirement.

### Mobile

On mobile:

- top 1 remains full-width
- top 2 and top 3 may remain compact, but must not feel cramped
- backup cards should stack vertically
- guidance items should use comfortable line-height and tap-friendly spacing
- no card should rely on hover behavior
- tags and metric chips should wrap cleanly without overflow

### Desktop / PC

On desktop:

- preserve the current centered results experience
- top 1 remains visually dominant
- top 2 and top 3 can stay side-by-side
- backup cards may be displayed as a two-column row if space allows
- guidance block should not stretch into unreadably long lines

### Shared layout rules

- image areas must preserve aspect ratio gracefully
- text truncation should be intentional and not cut off key meaning
- cards must remain readable at common widths without manual zoom
- no section should create horizontal scrolling

## Backup Card Content Model

Each backup card should display:

- product image
- product name
- price
- one primary backup-direction label
- one short explanation line
- 2 to 3 compact metric chips
- outbound product link

Recommended metric chips:

- `maxDb`
- `waterproof`
- `motorType`
- `appearance`

The exact chips can vary by data availability, but the card should avoid empty placeholders.

## Data Model Changes

The result state should be expanded to include dedicated fields for:

- backup candidates
- shopping guidance

Suggested shape direction:

- keep `topProducts` as-is for the main section
- add a separate `backupProducts` array
- add `shoppingGuidance` as a dedicated list of strings

If needed, backup card items can extend the current ranked product shape with:

- `backupLabel`
- `backupReason`

This keeps rendering logic explicit and avoids overloading `topProducts`.

## Result Generation Flow

1. Run the existing structured candidate scoring.
2. Build the rerank pool for top-3 selection.
3. Finalize top 3 using the current AI rerank path with fallback.
4. Build backup candidates from the structured ranking results excluding top 3.
5. Ask AI for:
   - backup short reasons
   - shopping guidance
6. If AI fails, derive both locally from rules and ranking metadata.
7. Persist the expanded result payload into app state.
8. Render the three result sections responsively.

## Error Handling

- malformed AI response must not block results rendering
- duplicate products must not appear across top 3 and backup cards
- backup cards should not render if only weak duplicates are available
- missing images, links, or metric values should degrade gracefully
- old persisted app state should not crash the new result screen

## Testing Strategy

Targeted coverage should include:

- backup candidate selection excludes top 3
- backup candidate selection prefers differentiated directions
- fallback explanation generation works when AI returns nothing
- guidance fallback works for narrow candidate pools
- results page renders correctly with:
  - top 3 only
  - top 3 + guidance
  - top 3 + backup cards + guidance
  - no backup candidates

Manual verification should cover:

- common mobile width
- tablet width
- desktop width
- long product names
- missing image / sparse metadata cases

## Implementation Notes

- preserve the current ranking pipeline and avoid rewriting it
- add enhancement logic as a layer after top-3 finalization
- keep the visual language aligned with the existing app
- avoid overloading the page with too much prose
- prioritize fast scanning and decision support

## Success Criteria

The feature is successful when:

- the user still gets a clear top 3
- the page also shows a separate set of meaningful backup products
- the page includes concise advice that helps users choose or adjust criteria
- the result page remains readable and polished on both mobile and desktop
- the system still behaves sensibly when AI output is absent
