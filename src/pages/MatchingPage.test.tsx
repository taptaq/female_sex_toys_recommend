import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchingPage } from "./MatchingPage.tsx";

test("matching page renders a soft female MVP loading ritual", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="loading"
      loadingStep={1}
      isAiMatching={false}
      tags={[]}
    />,
  );

  assert.match(html, /LUNA 装备校准中/);
  assert.match(html, /正在为你挑一件舒服的装备/);
  assert.match(html, /正在为 Luna 打开推荐舱/);
  assert.match(html, /先休息一下，马上回来。/);
  assert.doesNotMatch(html, /链路解析中/);
  assert.doesNotMatch(html, /雷达/);
  assert.doesNotMatch(html, /量子晶体/);
});

test("matching page keeps the answer-driven matching state", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="matching"
      isAiMatching
      tags={["静音", "新手友好", "低调"]}
    />,
  );

  assert.match(html, /LUNA 装备校准中/);
  assert.match(html, /Luna 正在认真匹配/);
  assert.match(html, /大概需要 1-2 分钟，请先别关闭页面。/);
  assert.match(html, /只筛选女性向候选/);
  assert.match(html, /静音/);
  assert.match(html, /新手友好/);
});

test("matching page moves the safety and exploration planets into the loading ritual", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="matching"
      isAiMatching
      tags={[]}
    />,
  );
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(html, /\/assets\/luna-planets\/safety\.png/);
  assert.match(html, /\/assets\/luna-planets\/explore\.png/);
  assert.equal((html.match(/female-mvp-matching__planet-image/g) ?? []).length, 2);
  assert.match(source, /\.female-mvp-matching__planet-safety/);
  assert.match(source, /\.female-mvp-matching__planet-explore/);
}
);

test("matching page uses the shared Luna astronaut image instead of the old radar shell", () => {
  const html = renderToStaticMarkup(
    <MatchingPage
      pageVariants={{}}
      mode="matching"
      isAiMatching
      tags={[]}
    />,
  );
  const source = fs.readFileSync(
    path.resolve(process.cwd(), "src/pages/MatchingPage.tsx"),
    "utf8",
  );

  assert.match(html, /\/assets\/luna-astronaut\/yeah\.png/);
  assert.match(html, /female-mvp-matching__astronaut-image/);
  assert.doesNotMatch(source, /CuteAstronaut/);
  assert.match(source, /female-mvp-matching/);
  assert.match(source, /gsap\.fromTo/);
  assert.match(source, /getGsapDuration/);
  assert.match(source, /if \(!ritualRef\.current\) return;/);
  assert.doesNotMatch(source, /FloatingKnowledgeField/);
  assert.doesNotMatch(source, /radar-container/);
});

test("matching page keeps lightweight ornamental motion for small screens", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.female-mvp-matching\s*\{[\s\S]*linear-gradient\(160deg, #fff8ea/);
  assert.match(source, /\.female-mvp-matching__stars\s*\{[\s\S]*female-mvp-stars-drift 34s linear infinite/);
  assert.match(source, /\.female-mvp-matching__halo\s*\{[\s\S]*female-mvp-matching-orbit 7s ease-in-out infinite/);
  assert.match(source, /\.female-mvp-matching__comet\s*\{[\s\S]*female-mvp-matching-comet 1\.55s ease-in-out infinite/);
  assert.match(
    source,
    /\.ambient-motion-paused \.female-mvp-matching__stars,[\s\S]*\.ambient-motion-paused \.female-mvp-matching__comet/,
  );
});
