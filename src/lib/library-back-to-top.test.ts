import test from "node:test";
import assert from "node:assert/strict";
import {
  LIBRARY_BACK_TO_TOP_THRESHOLD,
  shouldShowLibraryBackToTop,
} from "./library-back-to-top.ts";

test("shouldShowLibraryBackToTop stays hidden at the threshold", () => {
  assert.equal(shouldShowLibraryBackToTop(0), false);
  assert.equal(
    shouldShowLibraryBackToTop(LIBRARY_BACK_TO_TOP_THRESHOLD),
    false,
  );
});

test("shouldShowLibraryBackToTop appears after the threshold", () => {
  assert.equal(
    shouldShowLibraryBackToTop(LIBRARY_BACK_TO_TOP_THRESHOLD + 1),
    true,
  );
  assert.equal(shouldShowLibraryBackToTop(960), true);
});
