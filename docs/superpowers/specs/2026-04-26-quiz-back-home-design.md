# Quiz Back Home Design

## Goal

Allow users to return to the home page while answering quiz questions.

The interaction should be explicit, easy to reach, and should reset the in-progress quiz instead of preserving partial answers.

## User Need

During the quiz flow, users may realize they want to stop answering and go back to the home screen.

The expected behavior is:

- a visible return entry in the quiz UI
- the entry is easy to reach from the upper-left area
- returning home clears the current quiz progress
- the behavior is limited to the quiz flow

## Confirmed Direction

Agreed direction:

- add a left-top back button in the quiz page
- clicking it returns to the home page
- current answers and derived results are cleared
- do not apply the same pattern to all pages

## Scope

In scope:

- `src/pages/QuizPage.tsx`
- `src/App.tsx`
- resetting quiz-state data before navigating home
- mobile and desktop placement for the button

Out of scope:

- changing result-page navigation
- changing browser-history behavior
- preserving partial quiz progress
- redesigning the whole quiz layout

## Chosen Approach

Recommended approach: `quiz-local UI trigger with app-level reset handler`

### How it works

1. Render a back-to-home button in the quiz page header area.
2. Pass a callback from `App` into `QuizPage`.
3. In `App`, centralize the reset behavior in one handler.
4. When triggered, clear the current quiz state and navigate to `/`.

### Why this approach

- the button only appears where it is needed
- state reset remains owned by the app shell
- the quiz page stays presentational
- the behavior is predictable and easy to maintain

## State Reset Behavior

Returning home should clear the same quiz-session data that would otherwise affect a future run, including:

- current `step`
- accumulated `answers`
- current top recommendations
- backup recommendations
- recommendation tips
- shopping guidance

The destination should be the home page, not the first quiz question.

## UI Behavior

The button should:

- appear in the upper-left area of the quiz view
- visually match the existing cold holographic style
- remain readable and tappable on mobile
- avoid competing with the current question title

The label should remain Chinese-only.

## Testing

Given the current repository setup, the safest validation path is focused integration verification:

- type-check after callback and state reset wiring
- production build after the quiz page button is added

## Risks

Main risk:

- reusing the existing quiz reset handler incorrectly could send the user back into `/quiz` instead of `/`

This design avoids that by using a dedicated handler for “clear state and go home”.
