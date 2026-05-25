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
    title: "你更接近哪种使用场景？",
    subtitle: "先校准环境，再判断推荐方向。",
    field: "gender",
    options: [
      { label: "独处放松", value: "female", tag: "独处" },
      { label: "同住环境", value: "male", tag: "同住" },
      { label: "情侣共玩", value: "unisex", tag: "情侣" },
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
      onSelectOption={() => {}}
      onBackQuestion={() => {}}
      onBackHome={() => {}}
    />,
  );

  assert.match(html, /female-mvp-quiz/);
  assert.match(html, /overflow-y-auto/);
  assert.match(html, /Luna 正在帮你校准/);
  assert.match(html, /刺激路径/);
  assert.doesNotMatch(html, /SCAN PHASE/);
  assert.doesNotMatch(html, /SIGNAL CHANNEL/);
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
  assert.match(pageMarkup, /female-mvp-quiz/);
  assert.match(pageMarkup, /min-h-\[100svh\]/);
  assert.doesNotMatch(pageMarkup, /quiz-scan-shell/);
});

test("quiz female MVP ambient elements pause when animation is disabled", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__stars/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__astronaut \.cute-astronaut__figure/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__astronaut \.cute-astronaut__bubble/);
  assert.match(source, /\.ambient-motion-paused \.female-mvp-quiz__astronaut \.cute-astronaut__star/);
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
