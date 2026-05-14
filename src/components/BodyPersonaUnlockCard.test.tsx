import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BodyPersonaUnlockCard } from "./BodyPersonaUnlockCard.tsx";

test("BodyPersonaUnlockCard renders the 0.5 yuan CTA", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaUnlockCard
      onStart={() => undefined}
      isBusy={false}
      freeSummary={null}
    />,
  );

  assert.match(html, /身体人格测试/);
  assert.match(html, /0\.5 元/);
  assert.match(html, /开始长期校准/);
  assert.match(html, /不替代当前主推荐/);
});

test("BodyPersonaUnlockCard switches to retry copy after a free summary exists", () => {
  const html = renderToStaticMarkup(
    <BodyPersonaUnlockCard
      onStart={() => undefined}
      isBusy={false}
      freeSummary={{
        title: "星幕型·隐秘安全感者",
        blurb: "你更在意低压力进入。",
      }}
    />,
  );

  assert.match(html, /更新长期画像/);
  assert.match(html, /你上一次的长期画像/);
  assert.match(html, /星幕型·隐秘安全感者/);
});
