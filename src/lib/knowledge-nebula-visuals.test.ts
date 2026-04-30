import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNebulaTextureVariants,
  buildNebulaFocusMotion,
  buildShootingStars,
  NEBULA_HOVER_TRANSITION,
  NEBULA_IDLE_TRANSITION,
} from "./knowledge-nebula-visuals.ts";
import fs from "node:fs";
import path from "node:path";

test("knowledge nebula hover transition uses a spring instead of a hard step", () => {
  assert.equal(NEBULA_HOVER_TRANSITION.type, "spring");
  assert.ok(NEBULA_HOVER_TRANSITION.stiffness >= 120);
  assert.ok(NEBULA_HOVER_TRANSITION.damping >= 20);
  assert.ok(NEBULA_IDLE_TRANSITION.damping >= 22);
});

test("knowledge nebula texture variants stay crisp instead of adding extra blur haze", () => {
  const variants = buildNebulaTextureVariants();

  assert.equal(variants.length, 5);
  assert.ok(
    variants.every((variant) => variant.filter.includes("contrast(")),
  );
  assert.ok(
    variants.every((variant) => !variant.filter.includes("blur(")),
  );
  assert.ok(
    variants.every((variant) => /transparent 6[6-8]%/.test(variant.mask)),
  );
  assert.ok(
    variants.every((variant) => variant.hoverScale >= 1.2),
  );
  assert.ok(
    variants.some((variant) => variant.hoverScale >= 1.28),
  );
});

test("knowledge nebula click focus motion has an obvious push-pull tunnel feel", () => {
  const motion = buildNebulaFocusMotion();

  assert.ok(motion.warpScaleEnd >= 8.2);
  assert.ok(motion.ringScaleEnd >= 10);
  assert.ok(motion.warpPeakOpacity >= 0.9);
  assert.ok(motion.ringPeakOpacity >= 0.95);
});

test("shooting stars travel across a longer right-to-left path", () => {
  const stars = buildShootingStars();

  assert.equal(stars.length, 4);
  assert.ok(stars.every((star) => star.travelX <= -50 || star.id === "meteor-4"));
  assert.ok(stars.some((star) => star.travelX <= -72));
  assert.ok(stars.every((star) => star.width >= 7.2));
});

test("nebula topic labels advertise pointer cursor affordance", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/NebulaLabelLayer.tsx",
    ),
    "utf8",
  );

  assert.match(source, /cursor-pointer/);
});
