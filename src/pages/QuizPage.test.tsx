import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { Question } from "../data/mock.ts";
import { QuizPage } from "./QuizPage.tsx";

const questions: Question[] = [
  {
    id: "scenario",
    title: "你更期待哪种刺激路径？",
    subtitle: "先校准方向，再判断推荐组合。",
    field: "physicalForm",
    options: [
      { label: "外部轻刺激", value: "external", tag: "外部震动/吮吸" },
      { label: "想试一点入体感", value: "internal", tag: "纯入体" },
      { label: "内外一起", value: "composite", tag: "复合机型" },
    ],
  } as Question,
];

const multiStepQuestions: Question[] = [
  questions[0],
  {
    id: "experience",
    title: "你更接近哪种反馈节奏？",
    subtitle: "先别追求最猛，先找最适合自己的进入方式。",
    field: "experienceLevel",
    options: [
      { label: "温和慢热", value: "sensitive", tag: "温柔慢热" },
      { label: "平衡进阶", value: "balanced", tag: "平衡进阶" },
      { label: "强刺激偏好", value: "intense", tag: "强刺激偏好" },
    ],
  } as Question,
  {
    id: "noise",
    title: "你对静音有多在意？",
    subtitle: "这会影响系统优先筛掉哪些结果。",
    field: "maxDb",
    options: [
      { label: "非常在意", value: 40, tag: "< 40dB" },
      { label: "一般在意", value: 50, tag: "< 50dB" },
      { label: "不太在意", value: 100, tag: "无限制分贝" },
    ],
  } as Question,
];

test("quiz page uses mobile female MVP presentation", () => {
  const femaleMvpQuestions: Question[] = [
    {
      id: "stimulation-path",
      title: "刺激路径",
      subtitle: "你更期待哪种身体反馈路线？",
      field: "physicalForm",
      options: [{ label: "外部温柔唤醒", value: "external", tag: "外部唤醒" }],
    } as Question,
  ];

  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={femaleMvpQuestions}
      shouldPlayLanding
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /female-mvp-quiz/);
  assert.match(html, /overflow-y-auto/);
  assert.match(html, /Luna 正在帮你校准/);
  assert.match(html, /female-mvp-quiz__astronaut-image/);
  assert.match(html, /female-mvp-quiz__astronaut-figure/);
  assert.match(html, /female-mvp-quiz__astronaut-landing/);
  assert.match(html, /female-mvp-quiz__entry-glow/);
  assert.match(html, /\/assets\/quiz-art\/luna\.png/);
  assert.match(html, /female-mvp-quiz__astronaut-blink-patch/);
  assert.match(html, /\/assets\/quiz-art\/luna-eyes-closed\.png/);
  assert.match(html, /female-mvp-quiz__prompt-art/);
  assert.match(html, /\/assets\/quiz-art\/prompt-orbit\.png/);
  assert.doesNotMatch(html, /cute-astronaut__figure/);
  assert.match(html, /刺激路径/);
  assert.doesNotMatch(html, /SCAN PHASE/);
  assert.doesNotMatch(html, /SIGNAL CHANNEL/);
});

test("quiz page keeps a small rotating prompt art set for later questions", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/pages/QuizPage.tsx"), "utf8");
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={2}
      activeQuestions={multiStepQuestions}
      shouldPlayLanding={false}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(source, /\/assets\/quiz-art\/prompt-orbit\.png/);
  assert.match(source, /\/assets\/quiz-art\/prompt-star\.png/);
  assert.match(source, /\/assets\/quiz-art\/prompt-cloud\.png/);
  assert.match(html, /\/assets\/quiz-art\/prompt-cloud\.png/);
  assert.doesNotMatch(html, /female-mvp-quiz__astronaut-landing/);
  assert.doesNotMatch(html, /female-mvp-quiz__entry-glow/);
});

test("quiz page primary back action returns to the previous layer label", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, />返回<\/span>/);
  assert.doesNotMatch(html, /返回首页/);
});

test("quiz Luna landing animation only plays when the route entrance requests it", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/pages/QuizPage.tsx"), "utf8");
  const rendererSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/AppRouteRenderer.tsx"), "utf8");
  const staticFirstQuestion = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      shouldPlayLanding={false}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );
  const enteringFirstQuestion = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      shouldPlayLanding
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.doesNotMatch(source, /const shouldPlayLanding = step === 0;/);
  assert.match(rendererSource, /shouldPlayLanding=\{shouldPlayQuizLanding\}/);
  assert.doesNotMatch(staticFirstQuestion, /female-mvp-quiz__astronaut-landing/);
  assert.match(enteringFirstQuestion, /female-mvp-quiz__astronaut-landing/);
});

test("quiz page primary back action routes to the match mode layer", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const [, backHandler] = source.match(
    /const handleBackHomeFromQuiz = \(\) => \{([\s\S]*?)\n  \};/,
  ) ?? ["", ""];

  assert.match(backHandler, /navigateTo\("\/match-mode"\)/);
  assert.match(backHandler, /setMatchModeEntrance\("planet"\)/);
  assert.doesNotMatch(backHandler, /navigateTo\("\/"\)/);
});

test("female MVP quiz shell aligns to the top so short mobile viewports can scroll", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(source, /effectiveShellRoute === "\/quiz" && isFemaleMvp\s*\?\s*"overflow-y-auto overflow-x-hidden"/);
  assert.match(source, /const shellAlignmentClassName =[\s\S]*effectiveShellRoute === "\/quiz" && isFemaleMvp[\s\S]*\? "justify-start"[\s\S]*: "justify-center";/);
  assert.doesNotMatch(
    source,
    /"theme-synced-page relative flex flex-col items-center justify-center"/,
  );
});

test("quiz female MVP background is scoped to the quiz shell", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const pageMarkup = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(source, /\.female-mvp-quiz\s*\{/);
  assert.match(source, /\.female-mvp-quiz__stars/);
  assert.match(source, /\.female-mvp-option/);
  assert.match(source, /\.female-mvp-quiz__prompt-art/);
  assert.match(source, /\.female-mvp-quiz__prompt-art-image/);
  assert.match(source, /@keyframes female-mvp-quiz-luna-drop-in/);
  assert.match(source, /translate3d\(0\.9rem, -72svh, 0\) rotate\(18deg\) scale\(0\.54\);/);
  assert.match(source, /translate3d\(-0\.7rem, -0\.72rem, 0\) rotate\(-9deg\) scale\(1\.02\);/);
  assert.match(source, /translate3d\(0\.36rem, 0\.2rem, 0\) rotate\(5deg\) scale\(0\.985\);/);
  assert.match(source, /@keyframes female-mvp-quiz-entry-glow/);
  assert.match(source, /@keyframes female-mvp-quiz-luna-blink/);
  assert.match(source, /\.female-mvp-quiz__astronaut-landing\s*\{[\s\S]*?animation: female-mvp-quiz-luna-drop-in 1120ms/);
  assert.match(source, /\.female-mvp-quiz__astronaut-landing \.female-mvp-quiz__entry-glow\s*\{[\s\S]*?animation-delay: 460ms;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-figure\s*\{[\s\S]*?animation: female-mvp-astronaut-bob 4\.8s ease-in-out infinite;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-landing \.female-mvp-quiz__astronaut-figure\s*\{[\s\S]*?animation-delay: 1120ms;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-blink-patch\s*\{[\s\S]*?clip-path: ellipse\(28% 13% at 50% 37%\);[\s\S]*?animation: female-mvp-quiz-luna-blink 5\.8s ease-in-out 1\.4s infinite;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-landing \.female-mvp-quiz__astronaut-blink-patch\s*\{[\s\S]*?animation: female-mvp-quiz-luna-blink 5\.8s ease-in-out infinite;[\s\S]*?animation-delay: 2\.05s;/);
  assert.match(pageMarkup, /female-mvp-quiz-card/);
  assert.doesNotMatch(pageMarkup, /female-mvp-quiz-card[^"]*overflow-hidden/);
  assert.match(pageMarkup, /female-mvp-quiz/);
  assert.match(pageMarkup, /min-h-\[100svh\]/);
  assert.doesNotMatch(pageMarkup, /quiz-scan-shell/);
});

test("quiz female MVP ambient elements pause when animation is disabled", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__stars/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__astronaut-figure/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__astronaut-blink-patch/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__prompt-art-image/);
});

test("quiz animated art layers are isolated for smoother compositing", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.female-mvp-quiz__stars\s*\{[\s\S]*?will-change: transform;/);
  assert.match(source, /\.female-mvp-quiz__prompt-art-image\s*\{[\s\S]*?will-change: transform;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-figure\s*\{[\s\S]*?will-change: transform;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-image\s*\{[\s\S]*?will-change: opacity;/);
  assert.match(source, /\.female-mvp-quiz__astronaut-blink-patch\s*\{[\s\S]*?will-change: opacity;/);
  assert.match(source, /\.female-mvp-quiz-card\s*\{[\s\S]*?contain: paint;/);
});

test("female MVP quiz uses one local background layer instead of duplicating the shell cosmos", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(source, /currentRoute === "\/quiz" && step < activeQuestions\.length && isFemaleMvp/);
  assert.match(source, /const shouldRenderThemeCosmosLayer =[\s\S]*!isFemaleMvpQuizRoute/);
  assert.match(source, /isFemaleMvpSoftShellRoute \? "female-mvp-soft-shell" : ""/);
});

test("quiz page reassures undecided users that the system can guide them forward", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={0}
      activeQuestions={questions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /拿不准也没关系/);
  assert.match(html, /可先让系统帮你判断/);
});

test("quiz page renders earlier completed steps as direct revise targets", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={2}
      activeQuestions={multiStepQuestions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
      onJumpToQuestion={() => {}}
    />,
  );

  assert.match(html, /返回修改第 1 题/);
  assert.match(html, /返回修改第 2 题/);
  assert.match(html, /cursor-pointer/);
});

test("quiz page shows a return-to-results entry when the user is revising answers from the results page", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={1}
      activeQuestions={multiStepQuestions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
      onBackResults={() => {}}
    />,
  );

  assert.match(html, /返回结果页/);
});

test("quiz page hides the return-to-results entry during a fresh quiz flow", () => {
  const html = renderToStaticMarkup(
    <QuizPage
      pageVariants={{}}
      step={1}
      activeQuestions={multiStepQuestions}
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.doesNotMatch(html, /返回结果页/);
});
