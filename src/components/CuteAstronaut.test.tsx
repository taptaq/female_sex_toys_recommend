import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CuteAstronaut } from "./CuteAstronaut.tsx";

test("cute astronaut renders as decorative artwork by default", () => {
  const html = renderToStaticMarkup(<CuteAstronaut />);

  assert.match(html, /cute-astronaut/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /role="img"/);
});

test("cute astronaut renders as labelled artwork when label is provided", () => {
  const html = renderToStaticMarkup(<CuteAstronaut label="Luna 小宇航员" />);

  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Luna 小宇航员"/);
});
