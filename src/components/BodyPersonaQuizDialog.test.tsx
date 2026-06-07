import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BODY_PERSONA_QUESTIONS } from "../lib/body-persona.ts";
import { BodyPersonaQuizDialog } from "./BodyPersonaQuizDialog.tsx";

test("BodyPersonaQuizDialog renders the ten-question flow shell", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaQuizDialog
      questions={BODY_PERSONA_QUESTIONS}
      answers={{}}
      onClose={() => undefined}
      onChangeAnswer={() => undefined}
      onSubmit={() => undefined}
      isSubmitting={false}
    />,
  );

  assert.match(html, /10 道题/);
  assert.match(html, /当你准备开始一段只属于自己的体验时/);
  assert.match(html, /不会紧张、不会被打扰/);
  assert.match(html, /生成我的身体人格结果/);
  assert.doesNotMatch(html, /-mt-5/);
  assert.doesNotMatch(html, /-mx-5/);
  assert.doesNotMatch(html, /sticky top-0 z-10/);
  assert.match(html, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(html, /shrink-0 border-t border-sky-100/);
  assert.match(html, /px-4 pt-4 sm:px-6 sm:pt-6/);
  assert.match(html, /px-4 py-4 sm:px-6/);
  assert.equal(
    html.includes("bg-sky-950/18 px-3 py-2"),
    true,
  );
  assert.equal(
    html.includes("h-[calc(100dvh-1rem)] w-full max-w-3xl"),
    true,
  );
  assert.equal(html.includes("sm:h-[calc(100dvh-1rem)]"), true);
  assert.equal(
    html.includes("shadow-[0_1rem_2.4rem_rgba(125,211,252,0.14)]"),
    true,
  );
});

test("BodyPersonaQuizDialog marks the active answer and submitting state", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaQuizDialog
      questions={BODY_PERSONA_QUESTIONS}
      answers={{
        entry_anchor: "need_safe_first",
        spark_trigger: "cared_for",
        seen_shape: "fully_hidden",
        secret_feeling: "ordinary_double_use",
        mismatch_reaction: "pause_check",
        relax_context: "solo_quiet",
        rhythm_metaphor: "slow_prelude",
        control_need: "stop_anytime",
        private_hesitation: "fear_discovery",
        long_term_route: "safe_low_key",
      }}
      onClose={() => undefined}
      onChangeAnswer={() => undefined}
      onSubmit={() => undefined}
      isSubmitting
    />,
  );

  assert.match(html, /已完成 10 \/ 10/);
  assert.match(html, /正在生成中/);
  assert.match(html, /aria-pressed="true"/);
});
