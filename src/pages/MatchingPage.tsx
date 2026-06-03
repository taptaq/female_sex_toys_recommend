import { useEffect, useRef } from "react";
import gsap from "gsap";
import { motion } from "motion/react";
import { RotateCcw, Sparkles } from "lucide-react";
import { getGsapDuration } from "../lib/gsap-motion.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

export function MatchingPage({
  pageVariants,
  mode = "matching",
  loadingStep = 0,
  isAiMatching,
  tags,
}: {
  pageVariants: any;
  mode?: "loading" | "matching";
  loadingStep?: number;
  isAiMatching: boolean;
  tags: string[];
}) {
  const { shouldAnimate, prefersReducedMotion } = usePagePerformanceState();
  const ritualRef = useRef<HTMLDivElement | null>(null);
  const loadingText = [
    "正在整理你的偏好小星星...",
    "正在为 Luna 打开推荐舱...",
    "正在校准舒适度和隐私感...",
    "正在生成第一版装备清单...",
  ];
  const isLoadingMode = mode === "loading";
  const statusText =
    isLoadingMode
      ? loadingStep === -1
        ? "装备信号暂时断开"
        : loadingText[loadingStep] || "正在准备推荐舱"
      : isAiMatching
        ? "Luna 正在认真匹配..."
        : "正在把偏好变成推荐路线...";
  const helperText = isLoadingMode
    ? "先休息一下，马上回来。"
    : "我们只筛选女性向候选，再按你的偏好轻轻排序。";
  const calibrationSteps = isLoadingMode
    ? ["打开推荐舱", "读取偏好", "准备清单"]
    : ["女性向候选", "体感偏好", "温度限制"];

  useEffect(() => {
    if (!ritualRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".female-mvp-matching__reveal",
        { autoAlpha: 0, y: 18, scale: 0.97 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: getGsapDuration(0.48, { shouldAnimate, prefersReducedMotion }),
          ease: "back.out(1.35)",
          stagger: getGsapDuration(0.08, { shouldAnimate, prefersReducedMotion }),
        },
      );
    }, ritualRef);

    return () => ctx.revert();
  }, [statusText, shouldAnimate, prefersReducedMotion]);

  return (
    <motion.div
      key="loading"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "female-mvp-matching relative left-1/2 flex min-h-[100svh] w-screen -translate-x-1/2 flex-col items-center justify-center overflow-hidden px-4 py-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div className="female-mvp-matching__stars" aria-hidden="true" />
      <div className="female-mvp-matching__orb female-mvp-matching__orb-rose" aria-hidden="true" />
      <div className="female-mvp-matching__orb female-mvp-matching__orb-blue" aria-hidden="true" />
      <span className="female-mvp-matching__sticker female-mvp-matching__sticker-orbit" aria-hidden="true" />
      <span className="female-mvp-matching__sticker female-mvp-matching__sticker-meteor" aria-hidden="true" />
      <span className="female-mvp-matching__sticker female-mvp-matching__sticker-spark" aria-hidden="true" />

      <div
        ref={ritualRef}
        className="relative z-10 mx-auto flex w-full max-w-[24rem] flex-col items-center text-center"
      >
        <div className="female-mvp-matching__reveal relative">
          <div className="female-mvp-matching__halo" aria-hidden="true" />
          <div className="female-mvp-matching__scan-ring" aria-hidden="true" />
          <span className="female-mvp-matching__scan-dot female-mvp-matching__scan-dot-a" aria-hidden="true" />
          <span className="female-mvp-matching__scan-dot female-mvp-matching__scan-dot-b" aria-hidden="true" />
          <span
            className="female-mvp-matching__planet female-mvp-matching__planet-safety"
            aria-label="安心星"
          >
            <img
              src="/assets/luna-planets/safety.png"
              alt=""
              className="female-mvp-matching__planet-image"
            />
          </span>
          <span
            className="female-mvp-matching__planet female-mvp-matching__planet-explore"
            aria-label="探索星"
          >
            <img
              src="/assets/luna-planets/explore.png"
              alt=""
              className="female-mvp-matching__planet-image"
            />
          </span>
          <div className="female-mvp-matching__astronaut" role="img" aria-label="Luna 正在匹配你的推荐装备">
            <img
              src="/assets/luna-astronaut/matching-calibration.png"
              alt=""
              className="female-mvp-matching__astronaut-image"
            />
          </div>
        </div>
        <span className="female-mvp-matching__reveal mt-6 inline-flex items-center gap-2 rounded-full border border-white/76 bg-white/66 px-4 py-2 text-xs font-black tracking-[0.12em] text-rose-500 shadow-[0_14px_34px_rgba(244,114,182,0.16)] backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-sky-500" />
          LUNA 装备校准中
        </span>
        <h2 className="female-mvp-matching__reveal mt-5 text-2xl font-black leading-tight tracking-normal text-slate-900">
          正在为你挑一件合适的装备
        </h2>
        <p className="female-mvp-matching__reveal mt-3 text-sm font-semibold leading-7 tracking-normal text-slate-600">
          {statusText}
        </p>
        {!isLoadingMode && isAiMatching ? (
          <p className="female-mvp-matching__reveal mt-2 max-w-[18rem] text-xs leading-6 tracking-normal text-slate-500">
            大概需要 1-2 分钟，请先别关闭页面。
          </p>
        ) : null}
        <div className="female-mvp-matching__reveal female-mvp-matching__calibration-panel mt-7 w-full">
          <div className="female-mvp-matching__track" aria-hidden="true">
            <div className="female-mvp-matching__comet" />
          </div>
          <p className="mt-4 text-[12px] leading-6 tracking-normal text-slate-600">
            {helperText}
          </p>
          <div className="female-mvp-matching__step-list" aria-label="校准进度">
            {calibrationSteps.map((step) => (
              <span key={step} className="female-mvp-matching__step">
                {step}
              </span>
            ))}
          </div>
        </div>
        {loadingStep === -1 && isLoadingMode ? (
          <button
            onClick={() => window.location.reload()}
            className="female-mvp-matching__reveal mt-5 inline-flex items-center gap-2 rounded-full border border-rose-100/90 bg-white/72 px-4 py-2 text-xs font-black tracking-normal text-rose-500 shadow-[0_12px_30px_rgba(244,114,182,0.14)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新连接
          </button>
        ) : tags.length > 0 && !isLoadingMode ? (
          <div className="female-mvp-matching__reveal mt-5 flex flex-wrap justify-center gap-2">
            {tags.slice(0, 3).map((tag, index) => (
              <motion.span
              key={tag}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
                transition={{ delay: shouldAnimate ? index * 0.24 : 0 }}
                className="tag-flash female-mvp-matching__answer-tag"
            >
              {tag}
              </motion.span>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
