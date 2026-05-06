# Recommender Toys Single-Table Consolidation Design

## Goal

Make `public.recommender_toys` the only recommender product table used by the project.

All runtime logic, scripts, schema definitions, and scraper write paths should stop referencing `recommender_items` and move back to `recommender_toys`.

The database may currently contain both tables. This design defines how to consolidate them safely into a single final table without losing newer cleaned data.

## User Direction

Confirmed user requirements from discussion:

- keep `recommender_toys`
- do not keep `recommender_items` as an active table in the system
- move all `recommender_items` logic into `recommender_toys`
- when both tables contain overlapping data, preserve existing `recommender_toys` values first
- only fill blank fields in `recommender_toys` from `recommender_items`

This means the target is not a compatibility layer. The target is a full single-table rollback to `recommender_toys`.

## Current State

The repository currently treats `recommender_items` as the primary table across several layers:

- Prisma schema
- server startup schema initialization
- `/api/recommender/toys` read path
- backfill scripts
- mock sync script
- multiple scraper cleaners and update flows
- repository tests that enforce `recommender_items`

At the same time, older maintenance flows still acknowledge that `recommender_toys` may exist in connected databases.

This leaves the system in an inconsistent state:

- runtime code prefers `recommender_items`
- live databases may still contain `recommender_toys`
- some recovery scripts try to bridge both
- startup and maintenance behavior becomes fragile when the two tables drift

## Desired End State

After this project:

- `public.recommender_toys` is the only formal recommender product table
- Prisma exposes `recommender_toys`, not `recommender_items`
- the server reads from `recommender_toys`
- all backfill and migration scripts operate on `recommender_toys`
- all scraper cleaners write to `recommender_toys`
- tests assert `recommender_toys` as the canonical table
- `recommender_items` is no longer referenced by runtime logic

The final system should not silently pick one of two tables at runtime.

## Chosen Approach

Recommended approach: `one-shot consolidation to recommender_toys with explicit merge rules`

### Why this approach

- it matches the user's explicit goal directly
- it removes long-term ambiguity from the codebase
- it avoids future drift caused by two active tables
- it keeps migration behavior explicit instead of embedding hidden fallback logic into runtime code

### Alternatives considered

- keep a compatibility helper that supports both tables indefinitely
  - safer short term, but contradicts the goal of keeping only `recommender_toys`
- rename `recommender_items` back in code only and ignore data merge
  - faster, but risks losing newer cleaned data or causing table divergence
- make runtime prefer whichever table exists
  - operationally convenient, but guarantees future confusion and hard-to-debug drift

## Consolidation Strategy

### Canonical table

`public.recommender_toys` becomes the canonical and only supported recommender table.

### Merge direction

Merge data from `public.recommender_items` into `public.recommender_toys`.

`recommender_toys` is the destination table and keeps priority for existing non-empty values.

### Match order

To determine whether a row from `recommender_items` should update an existing row in `recommender_toys`:

1. match by `original_id` when available
2. if no usable `original_id` match exists, match by `name + brand`
3. if still unmatched, insert a new row into `recommender_toys`

### Conflict policy

For overlapping records:

- if `recommender_toys` already has a meaningful non-empty value, keep it
- if `recommender_toys` has `NULL`, empty string, or equivalent blank content, backfill from `recommender_items`

This applies to newly introduced cleaned fields as well, including:

- `safe_display_name`
- `brand`
- `material`
- `raw_description`
- any newer normalized fields that now exist in the active schema such as `type_code`

### Duplicate handling

The merge script should avoid creating duplicate rows for the same logical product when a stable match already exists.

If both tables contain the same product and neither `original_id` nor `name + brand` can match confidently, the row should be inserted and flagged in migration output counts so operators can inspect unusual additions later.

## Schema Direction

The schema definition should be rewritten so the project formally models `recommender_toys`.

That includes:

- Prisma model naming and table mapping
- startup schema initialization helper
- table comments or metadata emitted by migration scripts
- any field additions introduced during recent `recommender_items` work

The resulting `recommender_toys` table should support the current application field set, not regress to an older reduced schema.

At minimum, the canonical table must preserve the fields already used by the app and recent cleanup flows:

- `original_id`
- `name`
- `safe_display_name`
- `price`
- `max_db`
- `waterproof`
- `appearance`
- `physical_form`
- `motor_type`
- `gender`
- `brand`
- `material`
- `image_url`
- `raw_description`
- `type_code` if the library type filter work is retained
- timestamps used by existing queries

## Code Scope

### Prisma and typed access

Update Prisma so `recommender_toys` is the runtime model used by application code.

Any current `prisma.recommender_items` usage should become `prisma.recommender_toys`.

### Server runtime

Update server schema bootstrap and read APIs to target `public.recommender_toys`.

This includes:

- startup schema ensure logic
- `/api/recommender/toys` query source
- any logging or error messages that refer to the recommender table

### Maintenance and backfill scripts

All scripts that currently update or query `recommender_items` should switch to `recommender_toys`.

This includes:

- mock sync
- max dB backfill
- safe display name backfill
- qq recovery / name reclean backfill
- any startup helper added during recent initialization fixes

The old dual-table fallback inside recovery scripts should be removed once the dedicated merge script exists and the runtime has fully switched.

### Scraper and cleaner writes

All cleaner flows that currently delete and recreate rows in `recommender_items` should write into `recommender_toys` instead.

This must be applied consistently across all current scraper brands so future data ingestion does not recreate table drift.

### Tests and repository constraints

Update tests that currently encode `recommender_items` as canonical.

Add or update tests so the repo now enforces:

- `recommender_toys` is the canonical table name
- startup schema logic creates or upgrades `recommender_toys`
- merge logic preserves non-empty `recommender_toys` values
- new fields are still retained on the canonical table

## Migration Script Behavior

Introduce a dedicated migration script whose only job is to consolidate `recommender_items` into `recommender_toys`.

The script should:

- verify table existence clearly
- ensure destination schema is up to date before merge
- merge rows using the approved match order
- apply the approved field-priority rules
- report counts for:
  - rows matched by `original_id`
  - rows matched by `name + brand`
  - rows inserted newly
  - fields backfilled from `recommender_items`
  - rows skipped due to missing useful identifiers

The script does not need to auto-drop `recommender_items` in the same run if that adds operational risk, but after this feature the application code must no longer depend on it.

If a cleanup step to drop or archive `recommender_items` is provided, it should be explicit and separate from the merge step.

## Verification

Verification should happen in three layers.

### Targeted automated tests

Run focused tests for:

- schema helper behavior
- repository naming constraints
- merge-script conflict policy
- any tests touched by server or script refactors

### Runtime verification

Start the server and confirm:

- startup no longer fails because it expects `recommender_items`
- `/api/recommender/toys` can read from `recommender_toys`

### Migration verification

Run the merge script in a controlled environment and confirm:

- `recommender_toys` receives missing values from `recommender_items`
- existing non-empty `recommender_toys` fields are preserved
- unmatched `recommender_items` rows are inserted once

## Risks

### Risk: hidden references remain

The codebase has many scraper and script entry points. Missing even one write path could recreate `recommender_items` drift later.

Mitigation:

- sweep all repository references
- update tests to encode the new invariant

### Risk: field-set regression

If the rollback to `recommender_toys` only restores an old schema shape, newer app fields may disappear.

Mitigation:

- treat `recommender_toys` as the old name with the new schema, not as a downgrade

### Risk: duplicate products during merge

Rows missing stable identifiers may create duplicate records if matching is too weak.

Mitigation:

- prefer `original_id`
- use `name + brand` only as secondary matching
- emit explicit counts for inserted unmatched rows

### Risk: destructive cleanup too early

Dropping `recommender_items` before code and data migration are verified could make rollback harder.

Mitigation:

- separate data merge from destructive cleanup
- make runtime stop using `recommender_items` first

## Out of Scope

This design does not include:

- rewriting unrelated recommendation scoring logic
- changing library filter taxonomy beyond preserving current schema support
- redesigning scraper extraction logic unrelated to destination table writes
- introducing a permanent dual-table abstraction

## Success Criteria

This project is complete when all of the following are true:

- application runtime no longer references `recommender_items`
- Prisma no longer exposes `recommender_items` as the canonical model
- all scraper and maintenance write paths target `recommender_toys`
- the migration script can merge `recommender_items` into `recommender_toys` using the approved priority rules
- targeted tests pass
- the server starts successfully against a database where `recommender_toys` is the only active recommender table
