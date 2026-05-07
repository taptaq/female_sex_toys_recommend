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
