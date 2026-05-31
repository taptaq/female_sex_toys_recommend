import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MatchModePage } from "./MatchModePage.tsx";

function getCssBlock(source: string, selector: string) {
  return source.match(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "m"))?.[0] ?? "";
}

test("match mode page renders quiz and natural language entry options", () => {
  const html = renderToStaticMarkup(
    <MatchModePage
      pageVariants={{}}
      onSelectQuizMode={() => {}}
      onSelectNaturalLanguageMode={() => {}}
      onSelectLuckyMode={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /选择探索方式/);
  assert.match(html, /按你的状态，进入一条更舒服的匹配路线/);
  assert.match(html, /female-mvp-mode-hero/);
  assert.match(html, /female-mvp-mode-title/);
  assert.match(html, /female-mvp-mode-subcopy/);
  assert.doesNotMatch(html, /选择一种探索方式/);
  assert.doesNotMatch(html, /你选方式，Luna 负责把选择变舒服/);
  assert.doesNotMatch(html, /先选一种方式/);
  assert.doesNotMatch(html, /再让 Luna 慢慢匹配/);
  assert.match(html, /轻问答/);
  assert.match(html, /用几个温柔问题校准感受/);
  assert.match(html, /直接说/);
  assert.match(html, /幸运抽取/);
  assert.match(html, /female-mvp-mode-page/);
  assert.match(html, /female-mvp-mode-orbit-stage/);
  assert.match(html, /female-mvp-mode-orbit-ring/);
  assert.match(html, /female-mvp-mode-planet-button/);
  assert.match(html, /female-mvp-mode-luna-guide/);
  assert.match(html, /female-mvp-mode-portal/);
  assert.match(html, /female-mvp-mode-launch-warp/);
  assert.match(html, /female-mvp-mode-launch-speedline/);
  assert.match(html, /female-mvp-mode-launch-iris/);
  assert.match(html, /female-mvp-mode-selected-panel/);
  assert.match(html, /\/assets\/luna-planets\/modes\/quiz\.png/);
  assert.match(html, /\/assets\/luna-planets\/modes\/talk\.png/);
  assert.match(html, /\/assets\/luna-planets\/modes\/lucky\.png/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-guide\.png/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-dive\.png/);
  assert.match(html, /\/assets\/luna-astronaut\/mode-portal\.png/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /慢慢来，我会陪你校准/);
  assert.match(html, /开始轻问答/);
  assert.match(html, /新手友好 · 约 2 分钟/);
  assert.match(html, /female-mvp-mode-selected-summary/);
  assert.match(html, /female-mvp-mode-selected-meta/);
  assert.doesNotMatch(html, /<h2>轻问答<\/h2>/);
  assert.doesNotMatch(html, /female-mvp-mode-card/);
});

test("match mode Luna guide docks left and dives into the active planet center", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");

  assert.match(source, /\.female-mvp-mode-portal\s*\{[\s\S]*?top: 38%;/);
  assert.match(source, /\.female-mvp-mode-luna-guide\s*\{[\s\S]*?transform: translate3d\(-7rem, -3\.1rem, 0\);/);
  assert.match(source, /\.female-mvp-mode-luna-bubble\s*\{[\s\S]*?right: calc\(100% \+ 0\.08rem\);/);
  assert.match(source, /\.female-mvp-mode-luna-bubble\s*\{[\s\S]*?max-width: 5\.05rem;/);
  const launchingGuideBlock = source.match(/\.female-mvp-mode-luna-guide-launching\s*\{[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(launchingGuideBlock, /transform: translate3d/);
  assert.match(source, /\.female-mvp-mode-luna-guide-launching \.female-mvp-mode-luna-image-guide\s*\{[\s\S]*?animation: female-mvp-mode-luna-guide-handoff 260ms/);
  assert.match(source, /\.female-mvp-mode-luna-guide-launching \.female-mvp-mode-luna-image-dive\s*\{[\s\S]*?animation: female-mvp-mode-luna-dive 960ms/);
  assert.doesNotMatch(source, /female-mvp-mode-page-launching \.female-mvp-mode-planet-button-active\s*\{[\s\S]*?animation: female-mvp-mode-launch-pulse/);
  assert.match(pageSource, /window\.setTimeout\(\(\) => \{[\s\S]*?\}, 980\);/);
  assert.match(source, /@keyframes female-mvp-mode-launch-speedline-flight/);
  assert.match(source, /@keyframes female-mvp-mode-launch-iris-warp/);
  assert.match(source, /@keyframes female-mvp-mode-active-planet-warp/);
  assert.match(source, /@keyframes female-mvp-mode-quiz-calibrate/);
  assert.match(source, /@keyframes female-mvp-mode-talk-signal/);
  assert.match(source, /@keyframes female-mvp-mode-lucky-spark/);
  assert.match(source, /\.female-mvp-mode-planet-button-quiz\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-quiz-calibrate/);
  assert.match(source, /\.female-mvp-mode-planet-button-natural-language\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-talk-signal/);
  assert.match(source, /\.female-mvp-mode-planet-button-lucky\[aria-pressed="true"\] \.female-mvp-mode-planet-aura\s*\{[\s\S]*?animation: female-mvp-mode-lucky-spark/);
  assert.match(source, /\.female-mvp-mode-page-launching \.female-mvp-mode-planet-button-active \.female-mvp-mode-planet-image\s*\{[\s\S]*?animation: female-mvp-mode-active-planet-warp 960ms/);
  assert.match(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-speedline\s*\{[\s\S]*?animation: female-mvp-mode-launch-speedline-flight 720ms/);
  assert.match(source, /\.female-mvp-mode-launch-warp-active \.female-mvp-mode-launch-iris\s*\{[\s\S]*?animation: female-mvp-mode-launch-iris-warp 960ms/);
  assert.match(source, /46%\s*\{[\s\S]*?transform: translate3d\(4\.5rem, -1\.4rem, 0\) rotate\(20deg\) scale\(0\.62\);/);
  assert.match(source, /72%\s*\{[\s\S]*?transform: translate3d\(6\.28rem, -0\.74rem, 0\) rotate\(26deg\) scale\(0\.3\);/);
  assert.match(source, /100%\s*\{[\s\S]*?transform: translate3d\(7\.2rem, -0\.08rem, 0\) rotate\(30deg\) scale\(0\.1\);/);
});

test("match mode planet switching eases between orbit slots without delaying clicks", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");
  const planetButtonBlock = getCssBlock(source, ".female-mvp-mode-planet-button");
  const planetImageBlock = getCssBlock(source, ".female-mvp-mode-planet-image");

  assert.match(planetButtonBlock, /opacity 520ms ease/);
  assert.match(planetButtonBlock, /transform 680ms cubic-bezier\(0\.18, 0\.86, 0\.2, 1\)/);
  assert.match(planetImageBlock, /will-change: transform;/);
  assert.doesNotMatch(pageSource, /setTimeout\(\(\) => \{\s*setActiveModeId/);
});

test("match mode selected panel sits lower below the active planet", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.female-mvp-mode-selected-panel\s*\{[\s\S]*?margin-top: 1\.5rem;/);
});

test("match mode touch tracking does not trigger extra React renders", () => {
  const pageSource = fs.readFileSync(path.resolve(process.cwd(), "src/pages/MatchModePage.tsx"), "utf8");

  assert.match(pageSource, /import \{ useRef, useState \} from "react";/);
  assert.match(pageSource, /const touchStartXRef = useRef<number \| null>\(null\);/);
  assert.doesNotMatch(pageSource, /const \[touchStartX/);
  assert.doesNotMatch(pageSource, /setTouchStartX/);
});

test("match mode animations avoid repaint-heavy animated properties", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const planetButtonBlock = getCssBlock(source, ".female-mvp-mode-planet-button");
  const quizCalibrateKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-quiz-calibrate"),
    source.indexOf("@keyframes female-mvp-mode-talk-signal"),
  );
  const luckySparkKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-lucky-spark"),
    source.indexOf("@keyframes female-mvp-mode-luna-float"),
  );
  const activePlanetWarpKeyframes = source.slice(
    source.indexOf("@keyframes female-mvp-mode-active-planet-warp"),
    source.indexOf("@keyframes female-mvp-speed-pulse"),
  );

  assert.doesNotMatch(quizCalibrateKeyframes, /box-shadow:/);
  assert.doesNotMatch(luckySparkKeyframes, /filter:/);
  assert.doesNotMatch(activePlanetWarpKeyframes, /filter:/);
  assert.match(planetButtonBlock, /will-change: transform, opacity;/);
  assert.doesNotMatch(planetButtonBlock, /transition:[\s\S]*filter/);
});

test("match mode does not mount a duplicate cosmos background behind its own starfield", () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const matchModeRouteBlock =
    appSource.match(/if \(currentRoute === "\/match-mode"\) \{[\s\S]*?\n  \}/)?.[0] ?? "";

  assert.match(matchModeRouteBlock, /<MatchModePage/);
  assert.match(matchModeRouteBlock, /female-mvp-soft-shell/);
  assert.doesNotMatch(matchModeRouteBlock, /<ThemeCosmosLayer/);
});
