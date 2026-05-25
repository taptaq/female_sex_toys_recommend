import assert from "node:assert/strict";
import test from "node:test";

import { getGsapDuration, shouldRunGsapMotion } from "./gsap-motion.ts";

test("GSAP motion is disabled when the user prefers reduced motion", () => {
  const state = { shouldAnimate: true, prefersReducedMotion: true };

  assert.equal(shouldRunGsapMotion(state), false);
  assert.equal(getGsapDuration(0.8, state), 0);
});

test("GSAP motion is disabled when animation is not requested", () => {
  const state = { shouldAnimate: false, prefersReducedMotion: false };

  assert.equal(shouldRunGsapMotion(state), false);
  assert.equal(getGsapDuration(0.8, state), 0);
});

test("GSAP motion runs at the requested duration when animation is enabled", () => {
  const state = { shouldAnimate: true, prefersReducedMotion: false };

  assert.equal(shouldRunGsapMotion(state), true);
  assert.equal(getGsapDuration(0.8, state), 0.8);
});
