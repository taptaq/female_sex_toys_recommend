import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { motion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getGsapDuration, shouldRunGsapMotion } from "../lib/gsap-motion.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

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
    isComingSoon: true,
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
    isComingSoon: true,
  },
  {
    id: "library",
    eyebrow: "手选",
    title: "手动筛选",
    description: "直接进入产品库，按类型、品牌、价格和声音阈值自己慢慢筛。",
    meta: "自主比较 · 适合想自己挑",
    guide: "你来挑，我帮你排好。",
    cta: "进入产品库",
    asset: "/assets/luna-planets/modes/library.png",
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
  onSelectLibraryMode,
  onBackHome,
}: {
  pageVariants: any;
  entrance?: MatchModeEntrance;
  onSelectQuizMode: () => void;
  onSelectNaturalLanguageMode: () => void;
  onSelectLuckyMode: () => void;
  onSelectLibraryMode: () => void;
  onBackHome: () => void;
}) {
  const { repeat, shouldAnimate, prefersReducedMotion } = usePagePerformanceState();
  const [activeModeId, setActiveModeId] = useState<MatchModeId>("quiz");
  const [launchingModeId, setLaunchingModeId] = useState<MatchModeId | null>(null);
  const modePageRef = useRef<HTMLElement | null>(null);
  const didRunEntranceMotionRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const activeIndex = MATCH_MODE_OPTIONS.findIndex((mode) => mode.id === activeModeId);
  const activeMode = MATCH_MODE_OPTIONS[activeIndex] ?? MATCH_MODE_OPTIONS[0];
  const isLaunching = launchingModeId === activeMode.id;
  const isActiveModeComingSoon = Boolean("isComingSoon" in activeMode && activeMode.isComingSoon);
  const handlers = {
    quiz: onSelectQuizMode,
    "natural-language": onSelectNaturalLanguageMode,
    lucky: onSelectLuckyMode,
    library: onSelectLibraryMode,
  } satisfies Record<MatchModeId, () => void>;

  const runMatchModeLaunchMotion = () => {
    const root = modePageRef.current;
    if (!root) return;

    const motionState = { shouldAnimate, prefersReducedMotion };
    if (!shouldRunGsapMotion(motionState)) return;

    gsap.context(() => {
      gsap.killTweensOf([
        ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-image",
        ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-aura",
        ".female-mvp-mode-portal",
        ".female-mvp-mode-launch-warp",
        ".female-mvp-mode-launch-speedline",
        ".female-mvp-mode-launch-iris",
        ".female-mvp-mode-luna-image-guide",
        ".female-mvp-mode-luna-image-dive",
        ".female-mvp-mode-luna-bubble",
      ]);

      gsap.timeline({
        defaults: { ease: "sine.out" },
      })
        .addLabel("modeLaunchFocus")
        .to(
          ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-image",
          {
            y: -4,
            rotation: 0.8,
            scale: 1.055,
            duration: getGsapDuration(0.34, motionState),
            ease: "back.out(1.24)",
          },
          "modeLaunchFocus",
        )
        .to(
          ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-aura",
          {
            autoAlpha: 1,
            scale: 1.18,
            duration: getGsapDuration(0.28, motionState),
          },
          "modeLaunchFocus",
        )
        .to(
          ".female-mvp-mode-luna-bubble",
          {
            autoAlpha: 0,
            y: -4,
            duration: getGsapDuration(0.18, motionState),
          },
          "modeLaunchFocus",
        )
        .to(
          ".female-mvp-mode-luna-image-guide",
          {
            autoAlpha: 0,
            x: "0.14rem",
            y: "0.03rem",
            rotation: 1.8,
            scale: 0.978,
            duration: getGsapDuration(0.26, motionState),
          },
          "modeLaunchFocus",
        )
        .fromTo(
          ".female-mvp-mode-luna-image-dive",
          { autoAlpha: 0.08, x: "0.08rem", y: "0.02rem", rotation: 0, scale: 1 },
          {
            autoAlpha: 1,
            x: "0.72rem",
            y: "-0.14rem",
            rotation: 5,
            scale: 0.98,
            duration: getGsapDuration(0.16, motionState),
          },
          "modeLaunchFocus+=0.06",
        )
        .addLabel("modeLaunchWarp", "modeLaunchFocus+=0.18")
        .fromTo(
          ".female-mvp-mode-portal",
          { autoAlpha: 0, scale: 0.54, rotation: -10, xPercent: -50, yPercent: -50 },
          {
            autoAlpha: 0.92,
            scale: 0.92,
            rotation: 7,
            duration: getGsapDuration(0.3, motionState),
          },
          "modeLaunchWarp",
        )
        .to(
          ".female-mvp-mode-portal",
          {
            autoAlpha: 0,
            scale: 1.32,
            rotation: 24,
            duration: getGsapDuration(0.46, motionState),
          },
          ">",
        )
        .set(".female-mvp-mode-launch-warp", { autoAlpha: 1 }, "modeLaunchWarp")
        .fromTo(
          ".female-mvp-mode-launch-speedline",
          { autoAlpha: 0, x: "-0.85rem", scaleX: 0.46 },
          {
            autoAlpha: (index) => [0.68, 0.82, 0.52][index] ?? 0.68,
            x: "4.5rem",
            scaleX: 1.18,
            duration: getGsapDuration(0.72, motionState),
            stagger: getGsapDuration(0.052, motionState),
          },
          "modeLaunchWarp+=0.02",
        )
        .to(
          ".female-mvp-mode-launch-speedline",
          {
            autoAlpha: 0,
            duration: getGsapDuration(0.12, motionState),
            stagger: getGsapDuration(0.04, motionState),
          },
          ">-0.16",
        )
        .fromTo(
          ".female-mvp-mode-launch-iris",
          { autoAlpha: 0, scale: 0.18, rotation: -10, xPercent: -50, yPercent: -50 },
          {
            keyframes: [
              { autoAlpha: 0, scale: 0.18, rotation: -10, duration: getGsapDuration(0.28, motionState) },
              { autoAlpha: 0.84, scale: 0.54, rotation: 4, duration: getGsapDuration(0.18, motionState) },
              { autoAlpha: 0.58, scale: 1.02, rotation: 16, duration: getGsapDuration(0.18, motionState) },
              { autoAlpha: 0, scale: 1.34, rotation: 26, duration: getGsapDuration(0.18, motionState) },
            ],
          },
          "modeLaunchWarp+=0.08",
        )
        .to(
          ".female-mvp-mode-luna-image-dive",
          {
            keyframes: [
              { x: "2.5rem", y: "-1.2rem", rotation: 12, scale: 0.84, autoAlpha: 1, duration: getGsapDuration(0.16, motionState) },
              { x: "4.5rem", y: "-1.4rem", rotation: 20, scale: 0.62, autoAlpha: 1, duration: getGsapDuration(0.18, motionState) },
              { x: "6.28rem", y: "-0.74rem", rotation: 26, scale: 0.3, autoAlpha: 0.52, duration: getGsapDuration(0.24, motionState) },
              { x: "7.2rem", y: "-0.08rem", rotation: 30, scale: 0.1, autoAlpha: 0, duration: getGsapDuration(0.18, motionState) },
            ],
          },
          "modeLaunchWarp+=0.02",
        )
        .to(
          ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-image",
          {
            y: 0,
            rotation: -0.2,
            scale: 1.02,
            duration: getGsapDuration(0.36, motionState),
          },
          "modeLaunchWarp+=0.38",
        );
    }, root);
  };

  useEffect(() => {
    const root = modePageRef.current;
    if (!root) return;

    const motionState = { shouldAnimate, prefersReducedMotion };
    const revealMatchModeMotionTargets = () => {
      root
        .querySelectorAll<HTMLElement>(
          [
            ".female-mvp-mode-back",
            ".female-mvp-mode-hero",
            ".female-mvp-mode-orbit-ring",
            ".female-mvp-mode-orbit-control",
            ".female-mvp-mode-planet-button",
            ".female-mvp-mode-luna-guide",
            ".female-mvp-mode-luna-image-guide",
            ".female-mvp-mode-luna-bubble",
            ".female-mvp-mode-selected-panel",
            ".female-mvp-mode-start-button",
          ].join(", "),
        )
        .forEach((element) => {
          element.style.opacity = "";
          element.style.visibility = "";
          element.style.transform = "";
        });
    };

    if (!shouldRunGsapMotion(motionState)) {
      revealMatchModeMotionTargets();
      didRunEntranceMotionRef.current = true;
      return;
    }

    const ctx = gsap.context(() => {
      const runMatchModeEntranceMotion = () => {
        didRunEntranceMotionRef.current = true;

        const timeline = gsap.timeline({
          defaults: { ease: "sine.out" },
        });

        timeline
          .set(".female-mvp-mode-back", { autoAlpha: 0, y: -8 })
          .set(".female-mvp-mode-hero", { autoAlpha: 0, y: 12 })
          .set(".female-mvp-mode-orbit-ring", { autoAlpha: 0, scale: 0.86 })
          .set(".female-mvp-mode-orbit-control", { autoAlpha: 0, scale: 0.88 })
          .set(".female-mvp-mode-planet-button", { autoAlpha: 0, scale: 0.82 })
          .set(".female-mvp-mode-luna-guide", { autoAlpha: 0 })
          .set(".female-mvp-mode-luna-image-guide", { scale: 0.88, y: 12, rotation: -4 })
          .set(".female-mvp-mode-luna-bubble", { autoAlpha: 0, x: 8, y: 3 })
          .set(".female-mvp-mode-selected-panel", { autoAlpha: 0, y: 12 })
          .set(".female-mvp-mode-start-button", { autoAlpha: 0, y: 8 })
          .to(".female-mvp-mode-back", {
            autoAlpha: 1,
            y: 0,
            duration: getGsapDuration(0.28, motionState),
          })
          .to(
            ".female-mvp-mode-hero",
            {
              autoAlpha: 1,
              y: 0,
              duration: getGsapDuration(0.36, motionState),
            },
            "<0.08",
          )
          .addLabel("modeOrbitWake")
          .to(
            ".female-mvp-mode-orbit-ring",
            {
              autoAlpha: 1,
              scale: 1,
              stagger: getGsapDuration(0.08, motionState),
              duration: getGsapDuration(0.48, motionState),
            },
            "modeOrbitWake",
          )
          .to(
            ".female-mvp-mode-planet-button",
            {
              autoAlpha: 1,
              scale: 1,
              stagger: getGsapDuration(0.08, motionState),
              duration: getGsapDuration(0.5, motionState),
              ease: "back.out(1.3)",
            },
            "modeOrbitWake+=0.08",
          )
          .to(
            ".female-mvp-mode-orbit-control",
            {
              autoAlpha: 1,
              scale: 1,
              duration: getGsapDuration(0.3, motionState),
            },
            "<0.12",
          )
          .addLabel("modeLunaDock", ">-0.26")
          .to(
            ".female-mvp-mode-luna-guide",
            {
              autoAlpha: 1,
              duration: getGsapDuration(0.18, motionState),
            },
            "modeLunaDock",
          )
          .to(
            ".female-mvp-mode-luna-image-guide",
            {
              scale: 1,
              y: 0,
              rotation: 0,
              duration: getGsapDuration(0.48, motionState),
              ease: "back.out(1.12)",
            },
            "modeLunaDock",
          )
          .to(
            ".female-mvp-mode-luna-bubble",
            {
              autoAlpha: 0.92,
              x: 0,
              y: 0,
              duration: getGsapDuration(0.3, motionState),
            },
            "modeLunaDock+=0.16",
          )
          .to(
            ".female-mvp-mode-selected-panel",
            {
              autoAlpha: 1,
              y: 0,
              duration: getGsapDuration(0.36, motionState),
            },
            "modeLunaDock+=0.12",
          )
          .to(
            ".female-mvp-mode-start-button",
            {
              autoAlpha: 1,
              y: 0,
              duration: getGsapDuration(0.32, motionState),
            },
            "<0.08",
          );
      };

      if (!didRunEntranceMotionRef.current) {
        runMatchModeEntranceMotion();
      }
    }, root);

    return () => ctx.revert();
  }, [prefersReducedMotion, shouldAnimate]);

  useEffect(() => {
    const root = modePageRef.current;
    if (!root || !didRunEntranceMotionRef.current || launchingModeId) return;

    const motionState = { shouldAnimate, prefersReducedMotion };
    if (!shouldRunGsapMotion(motionState)) return;

    const idleRepeat = repeat === Infinity ? -1 : repeat;
    const ctx = gsap.context(() => {
      const runMatchModeActiveFocusMotion = () => {
        gsap.timeline({ defaults: { ease: "sine.out" } })
          .fromTo(
            ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-image",
            { scale: 0.94, rotation: -1.4 },
            {
              scale: 1,
              rotation: 0,
              duration: getGsapDuration(0.34, motionState),
              ease: "back.out(1.4)",
            },
          )
          .fromTo(
            ".female-mvp-mode-planet-button-active .female-mvp-mode-planet-aura",
            { autoAlpha: 0.35, scale: 0.84 },
            {
              autoAlpha: 1,
              scale: 1,
              duration: getGsapDuration(0.38, motionState),
            },
            "<",
          )
          .fromTo(
            ".female-mvp-mode-luna-image-guide",
            { y: -3, rotation: -2 },
            {
              y: 0,
              rotation: 0,
              duration: getGsapDuration(0.42, motionState),
            },
            "<0.04",
          )
          .fromTo(
            ".female-mvp-mode-selected-panel",
            { autoAlpha: 0.78, y: 5 },
            {
              autoAlpha: 1,
              y: 0,
              duration: getGsapDuration(0.3, motionState),
            },
            "<0.05",
          );

        gsap.to(".female-mvp-mode-planet-button-active .female-mvp-mode-planet-image", {
          y: -2,
          duration: getGsapDuration(3.6, motionState),
          ease: "sine.inOut",
          repeat: idleRepeat,
          yoyo: true,
          overwrite: "auto",
        });
      };

      runMatchModeActiveFocusMotion();
    }, root);

    return () => ctx.revert();
  }, [activeModeId, launchingModeId, prefersReducedMotion, repeat, shouldAnimate]);

  const rotateMode = (direction: -1 | 1) => {
    if (launchingModeId) return;
    const nextIndex =
      (activeIndex + direction + MATCH_MODE_OPTIONS.length) % MATCH_MODE_OPTIONS.length;
    setActiveModeId(MATCH_MODE_OPTIONS[nextIndex].id);
  };

  const startActiveMode = () => {
    if (launchingModeId || isActiveModeComingSoon) return;
    setLaunchingModeId(activeMode.id);
    runMatchModeLaunchMotion();
    window.setTimeout(() => {
      handlers[activeMode.id]();
    }, 980);
  };

  return (
    <motion.main
      ref={modePageRef}
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
            disabled={Boolean(launchingModeId) || isActiveModeComingSoon}
            className={[
              "female-mvp-mode-start-button",
              isActiveModeComingSoon ? "female-mvp-mode-start-button-disabled" : "",
            ].join(" ")}
          >
            {activeMode.cta}
          </button>
          {isActiveModeComingSoon ? (
            <p className="female-mvp-mode-coming-soon-note">
              该功能后续开放，尽情期待
            </p>
          ) : null}
        </section>

        <p className="mt-auto pt-4 text-center text-xs font-bold tracking-[0.08em] text-slate-400">
          隐私友好 · 本地体验 · 可随时返回
        </p>
      </div>
    </motion.main>
  );
}
