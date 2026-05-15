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

test("quiz page renders a differentiated deep-space scanning cockpit", () => {
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

  assert.match(html, /quiz-scan-shell/);
  assert.match(html, /isolate/);
  assert.match(html, /quiz-starfield/);
  assert.match(html, /SCAN PHASE 01/);
  assert.match(html, /SIGNAL CHANNEL 01/);
  assert.match(html, /偏好校准/);
  assert.doesNotMatch(html, /glass-panel rounded-3xl/);
  assert.doesNotMatch(html, /glass-button rounded-2xl/);
});

test("quiz scan background is sized to cover the full viewport", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
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

  assert.match(source, /\.quiz-scan-shell/);
  assert.match(source, /min-height: 100dvh/);
  assert.doesNotMatch(source, /\.quiz-starfield\s*{[^}]*animation:/s);
  assert.match(source, /\.quiz-starfield::before/);
  assert.match(source, /@keyframes quiz-starfield-drift/);
  assert.match(appSource, /currentRoute === "\/quiz"\s*\?\s*"h-dvh min-h-dvh p-0"/);
  assert.match(pageMarkup, /flex/);
  assert.match(pageMarkup, /justify-center/);
});

test("quiz page reduces starfield drift density on small screens", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");

  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.quiz-starfield::before\s*\{[\s\S]*opacity:\s*0\.48;/,
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.quiz-starfield::before\s*\{[\s\S]*background-size:\s*240px 280px,\s*340px 360px,\s*460px 500px;/,
  );
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
