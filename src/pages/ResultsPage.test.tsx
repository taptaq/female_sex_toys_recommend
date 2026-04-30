import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { RankedProduct } from "../lib/app-shell.ts";
import { ResultsPage } from "./ResultsPage.tsx";

function makeProduct(overrides: Partial<RankedProduct>): RankedProduct {
  return {
    id: "p1",
    name: "Nebula Match",
    price: 269,
    score: 96,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Brand",
    material: "Silicone",
    imagePlaceholder: "",
    tags: ["静音"],
    matchSummary: ["适配当前使用方向", "价格落在预算区间内"],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    ...overrides,
  };
}

test("results page shows confidence, fit reasons, and caveats for the primary recommendation", () => {
  const html = renderToStaticMarkup(
    <ResultsPage
      pageVariants={{}}
      answers={{
        tags: ["静音"],
        maxDb: 50,
        waterproof: 7,
        budget: [100, 300],
      }}
      topProducts={[
        makeProduct({ id: "p1", name: "Primary Pick" }),
        makeProduct({ id: "p2", name: "Second Pick", score: 88 }),
      ]}
      backupProducts={[]}
      shoppingGuidance={[]}
      recommendationTips={[]}
      selectedResultProvider="dmxapi-mimo"
      isRecalibratingResults={false}
      resultRecalibrationError={null}
      onSelectResultProvider={() => {}}
      onRecalibrateResults={() => {}}
      onTuneResults={() => {}}
      onReset={() => {}}
    />,
  );

  assert.match(html, /高匹配/);
  assert.match(html, /为什么适合/);
  assert.match(html, /需要留意/);
  assert.match(html, /适配当前使用方向/);
  assert.match(html, /主要参数与当前偏好吻合/);
});
