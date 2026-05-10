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

  assert.equal(variants.length, 6);
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

test("nebula topic labels use tighter mobile spacing without shrinking desktop rhythm", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/NebulaLabelLayer.tsx",
    ),
    "utf8",
  );

  assert.match(source, /px-2\.5 py-2\.5 text-center/);
  assert.match(source, /sm:px-3 sm:py-2/);
  assert.match(source, /text-\[9px\] font-mono tracking-\[0\.24em\] text-\[rgb\(103,232,249\)\] sm:text-\[10px\] sm:tracking-\[0\.28em\]/);
  assert.match(source, /mt-1\.5 text-\[13px\] font-medium tracking-\[0\.12em\] text-\[rgb\(103,232,249\)\] sm:mt-2 sm:text-base sm:tracking-\[0\.14em\]/);
  assert.match(source, /mt-1 text-\[10px\] leading-\[1\.55\] text-\[rgb\(103,232,249\)\] sm:text-xs/);
});

test("nebula topic label text keeps the fixed cyan color across app themes", () => {
  const source = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "src/components/knowledge-nebula/NebulaLabelLayer.tsx",
    ),
    "utf8",
  );

  const fixedCyanMatches = source.match(/text-\[rgb\(103,232,249\)\]/g) ?? [];
  assert.ok(fixedCyanMatches.length >= 3);
  assert.doesNotMatch(source, /(number|title|summary): "text-(cyan|sky|indigo)/);
  assert.doesNotMatch(source, /\$\{accent\.title\}/);
  assert.doesNotMatch(source, /\$\{accent\.number\}/);
  assert.doesNotMatch(source, /\$\{accent\.summary\}/);
});
