import assert from "node:assert/strict";
import test from "node:test";

import {
  getAmbientAnimationMode,
  getAmbientAnimationRepeat,
  shouldRunAmbientAnimation,
} from "./page-performance.ts";

test("ambient animation mode pauses when the page is hidden", () => {
  assert.equal(
    getAmbientAnimationMode({
      isVisible: false,
      prefersReducedMotion: false,
    }),
    "paused",
  );
});

test("ambient animation mode reduces motion when the user prefers less movement", () => {
  assert.equal(
    getAmbientAnimationMode({
      isVisible: true,
      prefersReducedMotion: true,
    }),
    "reduced",
  );
});

test("ambient animation mode keeps full motion only when visible and unrestricted", () => {
  assert.equal(
    getAmbientAnimationMode({
      isVisible: true,
      prefersReducedMotion: false,
    }),
    "full",
  );
});

test("ambient animation repeat count can be passed directly to framer transitions", () => {
  assert.equal(getAmbientAnimationRepeat("full"), Infinity);
  assert.equal(getAmbientAnimationRepeat("reduced"), 0);
  assert.equal(getAmbientAnimationRepeat("paused"), 0);
});

test("ambient animation helper only runs expensive loops in full mode", () => {
  assert.equal(shouldRunAmbientAnimation("full"), true);
  assert.equal(shouldRunAmbientAnimation("reduced"), false);
  assert.equal(shouldRunAmbientAnimation("paused"), false);
});
