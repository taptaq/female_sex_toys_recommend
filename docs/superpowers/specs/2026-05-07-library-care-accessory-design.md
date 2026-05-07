# Library Care Accessory Design

## Goal

Keep lubricant, condom, and lingerie items in `recommender_toys`, but classify them into a dedicated library branch instead of misclassifying them as device categories or deleting them as contaminants.

## Confirmed Direction

- add one new top-level library type: `care_accessory`
- expose it in the library UI as `护理与周边`
- split it into three subtypes:
  - `lube_care` -> `润滑护理`
  - `condom` -> `避孕套`
  - `lingerie` -> `内衣服饰`
- keep accessory / adapter / connector / webcam / machine-platform rows in the delete path
- do not delete lubricant, condom, or lingerie rows

## Classification Rules

### Priority

1. contaminant guard and purge eligibility
2. `care_accessory`
3. existing device categories

### Subtype intent

- `lube_care`
  - explicit lube / lubricant / 润滑液 / 润滑剂 / 人体润滑 / 水基 / 玻尿酸 style care products
- `condom`
  - explicit 避孕套 / 安全套 / condom / 套套 style protection products
- `lingerie`
  - explicit 内衣 / 情趣内衣 / 蕾丝 / 连体衣 / 睡衣 / lingerie / bodysuit style apparel products

### Guardrails

- `内裤` alone must not force `lingerie`, because wearable remote products also use panty-like language
- `乳胶` alone must not force `condom`
- contaminant deletion rules remain unchanged in purpose: replacement heads, adapters, connectors, webcams, and machine platforms still purge

## Frontend Behavior

- `护理与周边` appears as a first-level type for `all`, `female`, `male`, and `unisex`
- selecting it reveals three second-level subtype options
- existing type/subtype linked filtering remains unchanged

## Data Refresh

- extend shared `type_code` / `subtype_code` metadata
- reuse the shared classifier in backfill
- run live `db:backfill:item-type-code` after verification so existing rows move out of device buckets
