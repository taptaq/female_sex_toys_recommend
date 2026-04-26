# Product Image Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product images fall back to one unified default visual whenever the image URL is missing or the remote image fails to load.

**Architecture:** Add one small shared product-image component plus one tiny helper test so the result page and shared product card both render the same fallback UI. Keep all changes in the frontend rendering layer and leave scraper, server, and database behavior unchanged.

**Tech Stack:** React 19, TypeScript, lucide-react, node:test, Vite

---

### File Map

**Create:**
- `src/components/ProductImage.tsx` — shared product image renderer with remote-image error fallback
- `src/lib/product-image.test.ts` — focused tests for the fallback decision helper

**Modify:**
- `src/components/ProductCardContent.tsx` — replace inline image rendering with shared product image component
- `src/pages/ResultsPage.tsx` — replace local image renderer with shared product image component

### Task 1: Add Fallback Decision Test

**Files:**
- Create: `src/lib/product-image.test.ts`
- Test: `src/lib/product-image.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getInitialProductImageState,
  getNextProductImageStateOnError,
} from "../components/ProductImage.tsx";

test("getInitialProductImageState uses fallback when image is missing", () => {
  assert.deepEqual(getInitialProductImageState(""), {
    isRemoteImage: false,
    resolvedImageClassName: "",
  });
});

test("getInitialProductImageState keeps valid remote images", () => {
  assert.deepEqual(getInitialProductImageState("https://example.com/image.jpg"), {
    isRemoteImage: true,
    resolvedImageClassName: "",
  });
});

test("getNextProductImageStateOnError switches a remote image to fallback", () => {
  assert.deepEqual(
    getNextProductImageStateOnError("https://example.com/image.jpg"),
    {
      isRemoteImage: false,
      resolvedImageClassName: "",
    },
  );
});

test("getNextProductImageStateOnError preserves local gradient placeholders", () => {
  assert.deepEqual(
    getNextProductImageStateOnError("bg-gradient-to-br from-indigo-900/40 to-blue-900/40"),
    {
      isRemoteImage: false,
      resolvedImageClassName: "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/lib/product-image.test.ts`
Expected: FAIL because `src/components/ProductImage.tsx` does not exist yet

- [ ] **Step 3: Commit**

```bash
git add src/lib/product-image.test.ts
git commit -m "test: cover product image fallback state"
```

### Task 2: Implement Shared Product Image Component

**Files:**
- Create: `src/components/ProductImage.tsx`
- Test: `src/lib/product-image.test.ts`

- [ ] **Step 1: Write minimal implementation**

```tsx
import { useState } from "react";
import { Sparkles } from "lucide-react";

const DEFAULT_FALLBACK_CLASS_NAME =
  "bg-gradient-to-br from-slate-900/90 via-slate-800/95 to-cyan-950/90";

function isRemoteProductImage(value: string) {
  return /^https?:\/\//.test(value.trim());
}

export function getInitialProductImageState(imageValue: string) {
  const trimmed = imageValue.trim();
  return {
    isRemoteImage: isRemoteProductImage(trimmed),
    resolvedImageClassName: isRemoteProductImage(trimmed) ? "" : trimmed,
  };
}

export function getNextProductImageStateOnError(imageValue: string) {
  const trimmed = imageValue.trim();
  return {
    isRemoteImage: false,
    resolvedImageClassName: isRemoteProductImage(trimmed) ? "" : trimmed,
  };
}

export function ProductImage({
  imageValue,
  alt,
  iconClassName,
  imageClassName,
  fallbackClassName = "",
}: {
  imageValue: string;
  alt: string;
  iconClassName: string;
  imageClassName: string;
  fallbackClassName?: string;
}) {
  const [state, setState] = useState(() => getInitialProductImageState(imageValue));
  const resolvedFallbackClassName =
    state.resolvedImageClassName || fallbackClassName || DEFAULT_FALLBACK_CLASS_NAME;

  if (state.isRemoteImage) {
    return (
      <img
        src={imageValue}
        alt={alt}
        className={imageClassName}
        onError={() => setState(getNextProductImageStateOnError(imageValue))}
      />
    );
  }

  return (
    <div className={`flex h-full w-full items-center justify-center ${resolvedFallbackClassName}`}>
      <Sparkles className={iconClassName} />
    </div>
  );
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test src/lib/product-image.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ProductImage.tsx src/lib/product-image.test.ts
git commit -m "feat: add shared product image fallback"
```

### Task 3: Wire Shared Fallback Into Product Surfaces

**Files:**
- Modify: `src/components/ProductCardContent.tsx`
- Modify: `src/pages/ResultsPage.tsx`
- Test: `src/lib/product-image.test.ts`

- [ ] **Step 1: Replace inline product-card image rendering**

```tsx
import { ProductImage } from "./ProductImage";

<div className="aspect-[4/3] w-full overflow-hidden relative border-b border-white/5 bg-black/20">
  <ProductImage
    imageValue={product.imagePlaceholder}
    alt={product.name}
    iconClassName="w-8 h-8 text-white/10"
    imageClassName="h-full w-full object-cover opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-100"
  />
</div>
```

- [ ] **Step 2: Replace result-page image renderer**

```tsx
import { ProductImage } from "../components/ProductImage";

function renderProductImage(
  product: Pick<RankedProduct, "imagePlaceholder" | "name">,
  iconClassName: string,
) {
  return (
    <ProductImage
      imageValue={product.imagePlaceholder}
      alt={product.name}
      iconClassName={iconClassName}
      imageClassName="h-full w-full object-cover opacity-90"
    />
  );
}
```

- [ ] **Step 3: Run tests and type-check**

Run: `node --test src/lib/product-image.test.ts`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductCardContent.tsx src/pages/ResultsPage.tsx
git commit -m "feat: unify product image fallback rendering"
```
