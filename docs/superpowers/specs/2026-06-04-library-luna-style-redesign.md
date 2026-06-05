# Library Luna Style Redesign

## Goal

Make the product library page feel coordinated with the current Luna app theme while keeping the existing filter and product data behavior intact.

## Approved Direction

- Move the page from a dark cockpit style to a soft Luna app surface: pastel gradient, light glass panels, restrained cyan/rose accents.
- Keep the library as a functional browsing page, not a marketing landing page.
- Simplify the header: back action, short title, short helper copy, and a smaller sync button.
- Keep primary filters visible and advanced filters collapsed.
- Keep the product card implementation and all filtering logic unchanged.

## Scope

- `src/pages/LibraryPage.tsx`: update wrapper, header, filter panel, loading/error/empty shells, and product grid container classes.
- `src/pages/LibraryPage.test.tsx`: update visual contract assertions.
- `src/index.css`: update library-specific filter dropdown CSS if needed.

## Constraints

- No data model changes.
- No API/cache behavior changes.
- No product card content rewrite.
- Mobile-first, text must fit, and controls must remain easy to tap.
