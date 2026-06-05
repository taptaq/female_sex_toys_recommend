# Library Card Detail Modal Design

## Goal

Reduce product card surface density and separate in-app detail viewing from external product links.

## Approved Direction

- Product card surface shows only image, brand/name, price, audience/type chips, favorite, and a `查看详情信息` button.
- `查看详情信息` opens an in-app modal with material, noise, waterproof, motor, tags, persona analysis, brand brief, and description-style fields.
- External product links are not card wrappers. They appear only inside the modal as `打开产品详情链接`.
- Library grid remains 1 column on mobile, 2 on tablet, 3 on desktop for readability.

## Scope

- `src/components/ProductCardContent.tsx`: simplify card surface and add optional detail button.
- `src/pages/LibraryPage.tsx`: own selected product state and render detail modal.
- Tests update to lock the distinction between modal detail and external link.

## Constraints

- No filter/data behavior changes.
- No external navigation on the product card itself.
- Modal must have dialog semantics and be dismissible.
