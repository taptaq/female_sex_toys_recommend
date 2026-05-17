# BDSM Library Category Design

## Goal

Add a first-class `bdsm` library category to the existing `type_code` / `subtype_code` taxonomy, then backfill existing `recommender_toys` rows so BDSM products stop being mixed into `care_accessory`, `unknown`, or other broad buckets.

## Scope

This change covers:

- shared library type definitions
- shared library type/subtype classifier logic
- classifier test coverage
- database backfill via existing `backfill-item-type-code` flow

This change does not cover:

- frontend UI redesign beyond whatever automatically picks up the new type/subtype values
- scraper-specific one-off BDSM heuristics inside every brand cleaner
- reclassifying generic plugs into BDSM

## Taxonomy

### New top-level type

- `type_code = bdsm`

### New subtypes

- `bondage_restraint`
- `impact_play`
- `sensory_play`
- `gag_mask`
- `collar_leash`
- `anal_hook_probe`
- `nipple_play`
- `fetish_accessory`

## Category Boundary

### Included in BDSM

Products with clear signals for:

- cuffs, shackles, restraints, bondage tape, rope, hogties
- paddles, crops, whips, floggers, canes
- blindfolds, sensory masks, hoods, sensation play kits
- ball gags, mouth gags, mouth spreaders, masks
- collars, leashes, posture collars
- nipple clamps, nipple suckers when marketed as BDSM/fetish gear
- anal hooks and similar explicit BDSM control tools

### Excluded from BDSM

These stay in the current taxonomy:

- butt plugs, prostate plugs, vibrating plugs
- ordinary insertables or prostate toys
- generic lingerie unless explicitly modeled as fetish gear and better matched by BDSM than `lingerie`
- ordinary accessories and care items

Rule of thumb:

- explicit restraint / control / punishment / fetish gear -> `bdsm`
- ordinary penetrative toy -> existing toy category

## Classification Strategy

### Type-level strategy

Extend `classifyLibraryTypeCode()` with a new BDSM branch that activates when the signal text strongly indicates fetish gear, restraint gear, impact tools, gags, collars, nipple clamps, or anal hooks.

The BDSM branch should rank above:

- `care_accessory`
- `unknown`

It should not automatically outrank strongly signaled device categories like:

- `insertable`
- `prostate`
- `masturbator`

### Subtype-level strategy

Extend `classifyLibrarySubtypeCode()` with targeted keyword groups:

- `bondage_restraint`: cuff, restraint, rope, bondage tape, hogtie, shackle
- `impact_play`: whip, flogger, paddle, crop, cane, spanking
- `sensory_play`: blindfold, sensory deprivation, hood, mask when not better matched by gag
- `gag_mask`: gag, ball gag, mouth gag, mouth spreader
- `collar_leash`: collar, leash, posture collar
- `anal_hook_probe`: anal hook
- `nipple_play`: nipple clamp, nipple clip
- `fetish_accessory`: explicit BDSM/fetish accessory fallback when top-level BDSM is clear but no subtype dominates

## Database Cleaning Plan

Use the existing `src/db/backfill-item-type-code.ts` path rather than bespoke SQL.

Flow:

1. Update shared type and subtype definitions
2. Update shared classifier rules
3. Add and verify tests
4. Run `backfill-item-type-code`
5. Spot-check resulting rows in `recommender_toys`

`backfill-item-gender-and-dedupe` should only be rerun if the new category exposes follow-up merge issues. It is not required for the initial BDSM rollout.

## Risks

### False positives

Risk:

- ordinary lingerie or generic accessories getting pulled into BDSM

Mitigation:

- require stronger BDSM-specific signal terms than general sexy / lingerie wording
- keep `plug` alone out of BDSM

### False negatives

Risk:

- BDSM kits with vague naming staying `unknown`

Mitigation:

- allow explicit fallback subtype `fetish_accessory`
- use combined signals from name, raw description, and product tags

## Tests

Add classifier coverage for:

- restraint products
- whip/flogger products
- blindfold / sensory kit products
- gag products
- collar / leash products
- nipple clamp products
- anal hook products
- fetish accessory fallback
- negative cases:
  - butt plug should not become BDSM
  - lingerie should remain `care_accessory/lingerie`
  - lubricant should remain `care_accessory/lube_care`

## Expected Outcome

After implementation and backfill:

- BDSM products get a dedicated `type_code`
- major fetish gear gets meaningful `subtype_code`
- non-BDSM toys keep their current taxonomy boundaries
- database cleanup remains centralized in the shared backfill flow
