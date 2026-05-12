import assert from "node:assert/strict";
import test from "node:test";

import { buildBodyPersonaFullReport } from "./body-persona-report.ts";

test("buildBodyPersonaFullReport promotes aligned low-profile products", () => {
  const report = buildBodyPersonaFullReport({
    persona: {
      primaryPersonaCode: "starlit_guard",
      hiddenRouteCode: "daily_object",
      hiddenPowerGrade: "S",
      coLivingComfortGrade: "high",
      freeSummary: {
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
        why: "你在隐私与慢热维度更高。",
        hints: ["优先看低存在感路线"],
      },
    },
    candidatePool: [
      {
        id: "quiet-1",
        name: "Quiet Rose",
        score: 88,
        tags: ["高伪装", "静音"],
        typeCode: "external_vibe",
        appearance: "high_disguise",
        maxDb: 40,
      },
      {
        id: "loud-1",
        name: "Loud Wand",
        score: 92,
        tags: ["强刺激"],
        typeCode: "external_vibe",
        appearance: "normal",
        maxDb: 58,
      },
    ],
  });

  assert.equal(report.productPicks[0]?.id, "quiet-1");
  assert.match(report.hiddenRouteSummary, /日常器物型|隐藏力 S/);
  assert.equal(report.productPicks.length <= 5, true);
});
