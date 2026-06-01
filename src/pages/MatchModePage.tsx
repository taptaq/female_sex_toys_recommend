import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

const MATCH_MODE_OPTIONS = [
  {
    id: "quiz",
    eyebrow: "轻问",
    title: "轻问答",
    description: "用几个温柔问题校准感受、场景和边界，适合第一次认真了解自己。",
    meta: "新手友好 · 约 2 分钟",
    guide: "慢慢来，我会陪你校准。",
    cta: "开始轻问答",
    asset: "/assets/luna-planets/modes/quiz.png",
  },
  {
    id: "natural-language",
    eyebrow: "直说",
    title: "直接说",
    description: "把感受、场景或限制直接说出来，Luna 会帮你整理成可匹配的线索。",
    meta: "更自由 · 适合有想法时",
    guide: "你说，我来整理。",
    cta: "直接告诉 Luna",
    asset: "/assets/luna-planets/modes/talk.png",
  },
  {
    id: "lucky",
    eyebrow: "今日",
    title: "幸运抽取",
    description: "不想分析时，把选择交给今日幸运色，抽一份轻松的探索灵感。",
    meta: "随机灵感 · 轻松开始",
    guide: "今天交给一点直觉。",
    cta: "抽取今日幸运",
    asset: "/assets/luna-planets/modes/lucky.png",
  },
] as const;

type MatchModeId = (typeof MATCH_MODE_OPTIONS)[number]["id"];
export type MatchModeEntrance = "home" | "planet";

function getOrbitSlot(index: number, activeIndex: number) {
  const total = MATCH_MODE_OPTIONS.length;
  const diff = (index - activeIndex + total) % total;

  if (diff === 0) return "active";
  if (diff === 1) return "next";
  return "prev";
}

export function MatchModePage({
  pageVariants,
  entrance = "home",
  onSelectQuizMode,
  onSelectNaturalLanguageMode,
  onSelectLuckyMode,
  onBackHome,
}: {
  pageVariants: any;
  entrance?: MatchModeEntrance;
  onSelectQuizMode: () => void;
  onSelectNaturalLanguageMode: () => void;
  onSelectLuckyMode: () => void;
  onBackHome: () => void;
}) {
  const [activeModeId, setActiveModeId] = useState<MatchModeId>("quiz");
  const [launchingModeId, setLaunchingModeId] = useState<MatchModeId | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const activeIndex = MATCH_MODE_OPTIONS.findIndex((mode) => mode.id === activeModeId);
  const activeMode = MATCH_MODE_OPTIONS[activeIndex] ?? MATCH_MODE_OPTIONS[0];
  const isLaunching = launchingModeId === activeMode.id;
  const handlers = {
    quiz: onSelectQuizMode,
    "natural-language": onSelectNaturalLanguageMode,
    lucky: onSelectLuckyMode,
  } satisfies Record<MatchModeId, () => void>;

  const rotateMode = (direction: -1 | 1) => {
    if (launchingModeId) return;
    const nextIndex =
      (activeIndex + direction + MATCH_MODE_OPTIONS.length) % MATCH_MODE_OPTIONS.length;
    setActiveModeId(MATCH_MODE_OPTIONS[nextIndex].id);
  };

  const startActiveMode = () => {
    if (launchingModeId) return;
    setLaunchingModeId(activeMode.id);
    window.setTimeout(() => {
      handlers[activeMode.id]();
    }, 980);
  };

  return (
    <motion.main
      key="match-mode"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      aria-busy={isLaunching}
      className={[
        "female-mvp-mode-page relative left-1/2 min-h-[100svh] w-screen -translate-x-1/2 overflow-hidden px-4 pb-[calc(1.15rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-slate-900",
        entrance === "planet" ? "female-mvp-mode-page-from-planet" : "",
        isLaunching ? "female-mvp-mode-page-launching" : "",
      ].join(" ")}
    >
      <div className="female-mvp-mode-stars" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-2.2rem)] w-full max-w-[28rem] flex-col">
        <button
          type="button"
          onClick={onBackHome}
          className="female-mvp-mode-back inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-black tracking-[0.1em] text-sky-500"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回
        </button>

        <section className="female-mvp-mode-hero mt-7">
          <p className="female-mvp-mode-kicker">LUNA MATCH</p>
          <h1 className="female-mvp-mode-title">选择探索方式</h1>
          <p className="female-mvp-mode-subcopy">
            按你的状态，进入一条更舒服的匹配路线。
          </p>
        </section>

        <section
          className="female-mvp-mode-orbit-stage"
          aria-label="选择匹配模式"
          onTouchStart={(event) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const touchStartX = touchStartXRef.current;
            if (touchStartX == null) return;
            const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
            if (Math.abs(deltaX) > 34) {
              rotateMode(deltaX < 0 ? 1 : -1);
            }
            touchStartXRef.current = null;
          }}
        >
          <span className="female-mvp-mode-orbit-ring" aria-hidden="true" />
          <span className="female-mvp-mode-orbit-ring female-mvp-mode-orbit-ring-soft" aria-hidden="true" />
          <button
            type="button"
            className="female-mvp-mode-orbit-control female-mvp-mode-orbit-control-prev"
            onClick={() => rotateMode(-1)}
            aria-label="切换到上一个模式"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="female-mvp-mode-orbit-control female-mvp-mode-orbit-control-next"
            onClick={() => rotateMode(1)}
            aria-label="切换到下一个模式"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {MATCH_MODE_OPTIONS.map((mode, index) => {
            const slot = getOrbitSlot(index, activeIndex);
            const isActive = slot === "active";

            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  if (!launchingModeId) setActiveModeId(mode.id);
                }}
                className={[
                  "female-mvp-mode-planet-button",
                  `female-mvp-mode-planet-button-${mode.id}`,
                  `female-mvp-mode-planet-button-${slot}`,
                ].join(" ")}
              >
                <span className="female-mvp-mode-planet-aura" aria-hidden="true" />
                <img src={mode.asset} alt="" className="female-mvp-mode-planet-image" />
                <span className="female-mvp-mode-planet-label">
                  <span>{mode.eyebrow}</span>
                  <strong>{mode.title}</strong>
                </span>
              </button>
            );
          })}

          <span
            className={[
              "female-mvp-mode-portal",
              isLaunching ? "female-mvp-mode-portal-active" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            <img src="/assets/luna-astronaut/mode-portal.png" alt="" />
          </span>

          <span
            className={[
              "female-mvp-mode-launch-warp",
              isLaunching ? "female-mvp-mode-launch-warp-active" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            <span className="female-mvp-mode-launch-speedline female-mvp-mode-launch-speedline-one" />
            <span className="female-mvp-mode-launch-speedline female-mvp-mode-launch-speedline-two" />
            <span className="female-mvp-mode-launch-speedline female-mvp-mode-launch-speedline-three" />
            <span className="female-mvp-mode-launch-iris" />
          </span>

          <div
            className={[
              "female-mvp-mode-luna-guide",
              entrance === "planet"
                ? "female-mvp-mode-luna-guide-from-planet"
                : "female-mvp-mode-luna-guide-from-home",
              `female-mvp-mode-luna-guide-${activeMode.id}`,
              isLaunching ? "female-mvp-mode-luna-guide-launching" : "",
            ].join(" ")}
          >
            <span className="female-mvp-mode-luna-bubble">{activeMode.guide}</span>
            <img
              src="/assets/luna-astronaut/mode-guide.png"
              alt=""
              className="female-mvp-mode-luna-image female-mvp-mode-luna-image-guide"
            />
            <img
              src="/assets/luna-astronaut/mode-dive.png"
              alt=""
              className="female-mvp-mode-luna-image female-mvp-mode-luna-image-dive"
            />
          </div>
        </section>

        <section className="female-mvp-mode-selected-panel" aria-live="polite">
          <p className="female-mvp-mode-selected-meta">{activeMode.meta}</p>
          <p className="female-mvp-mode-selected-summary">{activeMode.description}</p>
          <button
            type="button"
            onClick={startActiveMode}
            disabled={Boolean(launchingModeId)}
            className="female-mvp-mode-start-button"
          >
            {activeMode.cta}
          </button>
        </section>

        <p className="mt-auto pt-4 text-center text-xs font-bold tracking-[0.08em] text-slate-400">
          隐私友好 · 本地体验 · 可随时返回
        </p>
      </div>
    </motion.main>
  );
}
