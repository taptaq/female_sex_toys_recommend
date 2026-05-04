import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ResultParameterGuide } from "./ResultParameterGuide.tsx";

test("expanded result parameter guide explains how to read quietness, waterproofing, and motor style", () => {
  const html = renderToStaticMarkup(
    <ResultParameterGuide
      isOpen={true}
      onToggle={() => {}}
      onOpenTopic={() => {}}
    />,
  );

  assert.match(html, /了解参数怎么看/);
  assert.match(html, /噪音怎么看/);
  assert.match(html, /dB 越低，越适合同住/);
  assert.match(html, /防水怎么看/);
  assert.match(html, /电机怎么看/);
  assert.match(html, /去知识星云继续看/);
  assert.match(html, /看静音与场景/);
  assert.match(html, /看清洁与护理/);
  assert.match(html, /看参数原理/);
});
