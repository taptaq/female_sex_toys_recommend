# Library Subtype Filter Design

## Goal

Add a user-facing secondary `类型细分` filter to the library without replacing the current top-level `type_code` filter.

The main goal is to help users distinguish high-overlap female product groups more naturally, using words they can understand immediately.

## Confirmed Direction

From the current discussion, the agreed direction is:

- keep the current top-level `类型` filter
- add a new second-level filter users can directly select
- use mixed naming logic when that is easier for users to understand
- prioritize female-facing subtypes first

## Data Shape

Keep `type_code` as the stable primary category field and add:

- `subtype_code`

This allows:

- stable existing filtering and backfill behavior
- incremental subtype rollout
- safer future refinement without reworking the entire top-level taxonomy

## First-Round Subtypes

Initial supported subtypes:

- `suction_pure` -> `纯吮吸`
- `suction_dual` -> `吮吸双刺激`
- `rabbit_dual` -> `兔耳双刺激`
- `multi_head_dual` -> `双头多点`
- `bullet_vibe` -> `跳蛋/子弹`
- `wand_massager` -> `魔杖按摩`
- `gspot_insertable` -> `G点探索`
- `insertable_vibe` -> `入体震动`

Mapped to parent top-level types:

- `suction` -> `suction_pure`, `suction_dual`
- `dual_stimulation` -> `rabbit_dual`, `multi_head_dual`
- `external_vibe` -> `bullet_vibe`, `wand_massager`
- `insertable` -> `gspot_insertable`, `insertable_vibe`

## UI Behavior

- Users select top-level `类型` first
- If the chosen top-level type has supported subtypes, show `类型细分`
- If top-level type is `全部类型`, hide the subtype filter
- If the selected subtype becomes invalid after top-level or gender changes, reset it to `全部细分`

## Classification Strategy

The subtype classifier should reuse the current signal corpus and resolved top-level type.

Examples:

- `兔耳`, `rabbit`, `兔嘴兔耳` -> `rabbit_dual`
- `双头`, `dual-ended` -> `multi_head_dual`
- clear suction-only products -> `suction_pure`
- suction products with strong dual-zone signals -> `suction_dual`
- `wand`, `魔杖`, `按摩棒` -> `wand_massager`
- `跳蛋`, `子弹`, `bullet` -> `bullet_vibe`
- `入体震动`, `震动棒`, strong internal vibration signals -> `insertable_vibe`
- otherwise insertable products with G-point focus -> `gspot_insertable`

## Scope

This design covers:

- subtype metadata and labels
- subtype classification helpers
- subtype payload support in frontend/server/cache
- linked subtype filtering in the library page
- backfill into `recommender_toys.subtype_code`

Out of scope:

- subtype rollout for male or unisex routes
- recommendation-score changes
- redesigning product cards
