# Library Type Classification Precision Design

## Goal

Improve `recommender_toys.type_code` classification accuracy without adding new filter categories.

The immediate objective is to reduce obvious cross-category misclassification for overlapping female-oriented products and to keep clear contaminants out of forced user-facing categories.

## Confirmed Direction

From the current discussion, the agreed product direction is:

- keep the existing type-code set unchanged for now
- improve classification precision before adding any new categories
- favor user-understandable filtering over technically exhaustive taxonomy
- prefer `unknown` over confident-looking but wrong forced classification

## Problem

The current classifier is mostly precedence-based:

- `dual_stimulation` wins early if certain combined signals appear
- `suction` wins before many insertable or external-vibe edge cases
- `insertable` can incorrectly absorb products that only mention `G-spot` as a target area
- noisy accessories or machines can be forced into a user-facing category because one or two keywords happen to match

This creates repeated backfill churn because the same products can swing between categories whenever a new keyword is added.

## Chosen Approach

Recommended approach: `Score-based classification with contaminant guards`

### Why this approach

- it handles overlapping signals better than first-match precedence
- it lets us strengthen important signals without rewriting the whole taxonomy
- it keeps the UI stable because the type-code list does not change
- it provides a safer path for another full backfill

### Alternatives considered

- keep adding precedence exceptions
  - low effort short term, but increasingly fragile
- introduce 1-2 new female subtypes immediately
  - may help later, but adds UI/data churn before current boundaries are stable

## Scope

This design covers:

- score-based classification improvements inside `src/lib/library-product-type-classifier.ts`
- stronger tests based on overlapping real-world product signals
- contaminant handling for accessories, adapters, and machines that should fall back to `unknown`
- a new full backfill of `recommender_toys.type_code`

Out of scope:

- changing library filter options
- adding new type codes
- redesigning product cards or recommendation ranking

## Classification Strategy

### Female-oriented products

Keep the existing four categories:

- `suction`
- `external_vibe`
- `insertable`
- `dual_stimulation`

Classify them by combining weighted signals from:

- `physicalForm`
- `name`
- `rawDescription`
- `tags`

Key intent:

- `dual_stimulation` should win only on strong multi-zone or rabbit-style evidence
- `suction` should win on explicit pressure-wave or suction-device evidence
- `insertable` should prefer strong internal-use evidence, not every incidental `G-spot` mention
- `external_vibe` should cover classic bullets, wands, eggs, and clitoral external stimulators

### Contaminants

When a product is clearly an accessory, adapter, camera-like item, or machine platform rather than a single handheld product in the current taxonomy:

- do not force a misleading category
- classify it as `unknown`

## Verification

Focused verification should include:

- classifier unit tests for overlapping female signals
- tests proving contaminants stay `unknown`
- backfill helper tests
- one full `type_code` backfill run against the current database

## Expected Outcome

After this change:

- the existing `类型` filter remains unchanged in the UI
- backfilled `type_code` values are more stable and less exception-driven
- obviously noisy products are less likely to appear under the wrong user-facing category
