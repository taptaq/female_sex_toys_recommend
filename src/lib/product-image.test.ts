import test from "node:test";
import assert from "node:assert/strict";
import {
  getInitialProductImageState,
  getNextProductImageStateOnError,
  normalizeProductImageSource,
  resolveProductImageValue,
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

test("getInitialProductImageState keeps base64 data images", () => {
  assert.deepEqual(
    getInitialProductImageState("data:image/png;base64,abc123"),
    {
      isRemoteImage: true,
      resolvedImageClassName: "",
    },
  );
});

test("getInitialProductImageState keeps blob images", () => {
  assert.deepEqual(
    getInitialProductImageState("blob:https://example.com/abc-123"),
    {
      isRemoteImage: true,
      resolvedImageClassName: "",
    },
  );
});

test("normalizeProductImageSource upgrades local product placeholders to webp", () => {
  assert.equal(
    normalizeProductImageSource("/assets/product-placeholder/bullet_vibe.png"),
    "/assets/product-placeholder/bullet_vibe.webp",
  );
  assert.equal(
    normalizeProductImageSource("/assets/product-placeholder/bullet_vibe.png?v=1"),
    "/assets/product-placeholder/bullet_vibe.webp?v=1",
  );
  assert.equal(
    normalizeProductImageSource("https://example.com/product.png"),
    "https://example.com/product.png",
  );
});

test("resolveProductImageValue normalizes legacy local placeholder png paths", () => {
  assert.deepEqual(
    resolveProductImageValue({
      imageValue: "/assets/product-placeholder/suction_pure.png",
      typeCode: "suction",
      subtypeCode: "suction_pure",
      gender: "female",
      physicalForm: "external",
    }),
    {
      resolvedImageValue: "/assets/product-placeholder/suction_pure.webp",
      taxonomyPlaceholderValue: "/assets/product-placeholder/suction_pure.webp",
    },
  );
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
    getNextProductImageStateOnError(
      "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
    ),
    {
      isRemoteImage: false,
      resolvedImageClassName: "bg-gradient-to-br from-indigo-900/40 to-blue-900/40",
    },
  );
});

test("resolveProductImageValue keeps real image source while preparing taxonomy fallback", () => {
  assert.deepEqual(
    resolveProductImageValue({
      imageValue: "695f9569c6dfd.png",
      typeCode: "external_vibe",
      subtypeCode: "bullet_vibe",
      gender: "female",
      physicalForm: "external",
    }),
    {
      resolvedImageValue: "695f9569c6dfd.png",
      taxonomyPlaceholderValue: "/assets/product-placeholder/bullet_vibe.webp",
    },
  );
});
