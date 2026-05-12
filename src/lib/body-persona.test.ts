import assert from "node:assert/strict";
import test from "node:test";

import {
  BODY_PERSONA_QUESTIONS,
  resolveBodyPersonaResult,
} from "./body-persona.ts";

test("BODY_PERSONA_QUESTIONS exposes a compact six-dimension quiz", () => {
  assert.equal(BODY_PERSONA_QUESTIONS.length >= 6, true);
  assert.equal(
    BODY_PERSONA_QUESTIONS.every((question) => question.options.length >= 3),
    true,
  );
});

test("resolveBodyPersonaResult returns a stable free summary for slow, private answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      safety_need: "high",
      privacy_need: "high",
      pace_preference: "slow",
      sensory_preference: "layered",
      control_preference: "manual",
      relationship_preference: "solo",
    },
  });

  assert.equal(result.primaryPersonaCode, "starlit_guard");
  assert.equal(result.hiddenRouteCode, "daily_object");
  assert.equal(result.hiddenPowerGrade, "S");
  assert.match(result.freeSummary.title, /星幕型|隐秘安全感者/);
  assert.match(result.freeSummary.why, /隐私|慢热|安全感/);
});

test("resolveBodyPersonaResult returns a fast-start profile for direct answers", () => {
  const result = resolveBodyPersonaResult({
    answers: {
      safety_need: "low",
      privacy_need: "medium",
      pace_preference: "fast",
      sensory_preference: "direct",
      control_preference: "hybrid",
      relationship_preference: "solo",
    },
  });

  assert.equal(result.primaryPersonaCode, "comet_spark");
  assert.equal(result.hiddenPowerGrade === "S", false);
  assert.match(result.freeSummary.title, /彗火型|即时点燃者/);
});
