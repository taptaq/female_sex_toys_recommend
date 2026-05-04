import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import {
  buildKnowledgeNebulaClusterAnchors,
  getKnowledgeNebulaTimeline,
  type KnowledgeNebulaViewport,
} from "../lib/knowledge-nebula-field.ts";
import {
  buildNebulaTextureVariants,
  buildNebulaFocusMotion,
  buildShootingStars,
  NEBULA_HOVER_TRANSITION,
  NEBULA_IDLE_TRANSITION,
} from "../lib/knowledge-nebula-visuals.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";
import { NebulaLabelLayer } from "./knowledge-nebula/NebulaLabelLayer.tsx";

type KnowledgeNebulaFieldProps = {
  topics: KnowledgeNebulaTopic[];
  selectedTopicSlug?: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
};

type NebulaStage = "aggregate" | "split" | "idle" | "focus";

function seededParticleValue(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildStarfieldShadow(count: number, salt: number, color: string) {
  return Array.from({ length: count }, (_, index) => {
    const x = seededParticleValue(index, salt) * 100;
    const y = seededParticleValue(index, salt + 1) * 100;
    const blur = seededParticleValue(index, salt + 2) > 0.84 ? 2 : 0;
    return `${x.toFixed(2)}vw ${y.toFixed(2)}vh ${blur}px ${color}`;
  }).join(",");
}

const PARTICLE_STAR_LAYERS = [
  {
    id: "distant-white",
    size: 1,
    opacity: 0.84,
    shadow: buildStarfieldShadow(150, 1, "rgba(255,255,255,0.72)"),
    duration: 6,
    delay: 0,
  },
  {
    id: "cyan-depth",
    size: 1.5,
    opacity: 0.72,
    shadow: buildStarfieldShadow(72, 9, "rgba(186,230,253,0.78)"),
    duration: 7.4,
    delay: 0.8,
  },
  {
    id: "violet-near",
    size: 2,
    opacity: 0.58,
    shadow: buildStarfieldShadow(36, 17, "rgba(245,208,254,0.72)"),
    duration: 8.6,
    delay: 1.7,
  },
] as const;

function getViewportMatch() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(min-width: 768px)").matches;
}

function getFocusStage(selectedTopicSlug?: KnowledgeNebulaTopicSlug): NebulaStage {
  return selectedTopicSlug ? "focus" : "idle";
}

export function KnowledgeNebulaField({
  topics,
  selectedTopicSlug,
  onSelectTopic,
}: KnowledgeNebulaFieldProps) {
  const { repeat, shouldAnimate } = usePagePerformanceState();
  const reducedMotionPreference = !shouldAnimate;
  const timeline = useMemo(
    () => getKnowledgeNebulaTimeline(reducedMotionPreference),
    [reducedMotionPreference],
  );
  const [viewport, setViewport] = useState<KnowledgeNebulaViewport>(() =>
    getViewportMatch() ? "desktop" : "mobile",
  );
  const [stage, setStage] = useState<NebulaStage>(() =>
    reducedMotionPreference ? getFocusStage(selectedTopicSlug) : "aggregate",
  );
  const [phase, setPhase] = useState(() => (reducedMotionPreference ? 1 : 0));
  const [focusedTopicSlug, setFocusedTopicSlug] = useState<
    KnowledgeNebulaTopicSlug | undefined
  >(selectedTopicSlug);
  const [hoveredTopicSlug, setHoveredTopicSlug] = useState<
    KnowledgeNebulaTopicSlug | undefined
  >();
  const aggregateTimeoutRef = useRef<number | null>(null);
  const focusTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const introRunTokenRef = useRef(0);
  const focusRunTokenRef = useRef(0);
  const hasSettledIntroRef = useRef(reducedMotionPreference);
  const onSelectTopicRef = useRef(onSelectTopic);

  const topicsBySlug = useMemo(
    () => new Map(topics.map((topic) => [topic.slug, topic] as const)),
    [topics],
  );
  const topicSlugs = useMemo(() => topics.map((topic) => topic.slug), [topics]);
  const anchors = useMemo(
    () =>
      buildKnowledgeNebulaClusterAnchors({
        topicSlugs,
        viewport,
      }),
    [topicSlugs, viewport],
  );
  const nebulaTextureVariants = useMemo(() => buildNebulaTextureVariants(), []);
  const selectedTopic = focusedTopicSlug
    ? topicsBySlug.get(focusedTopicSlug)
    : undefined;
  const shootingStars = useMemo(() => buildShootingStars(), []);
  const focusMotion = useMemo(() => buildNebulaFocusMotion(), []);
  const focusedAnchor = focusedTopicSlug
    ? anchors.find((anchor) => anchor.topicSlug === focusedTopicSlug)
    : undefined;

  useEffect(() => {
    onSelectTopicRef.current = onSelectTopic;
  }, [onSelectTopic]);

  const clearPendingFocusNavigation = () => {
    focusRunTokenRef.current += 1;
    if (focusTimeoutRef.current != null) {
      window.clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = null;
    }
  };

  const cancelIntroMotion = () => {
    introRunTokenRef.current += 1;
    if (aggregateTimeoutRef.current != null) {
      window.clearTimeout(aggregateTimeoutRef.current);
      aggregateTimeoutRef.current = null;
    }
    if (animationFrameRef.current != null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncViewport = (matches: boolean) => {
      setViewport(matches ? "desktop" : "mobile");
    };

    syncViewport(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    cancelIntroMotion();

    if (reducedMotionPreference) {
      hasSettledIntroRef.current = true;
      setPhase(1);
      setStage(getFocusStage(focusedTopicSlug));
      return undefined;
    }

    if (hasSettledIntroRef.current) {
      setPhase(1);
      setStage((currentStage) =>
        currentStage === "focus" ? currentStage : getFocusStage(selectedTopicSlug),
      );
      return undefined;
    }

    setPhase(0);
    setStage("aggregate");

    const introRunToken = introRunTokenRef.current;
    aggregateTimeoutRef.current = window.setTimeout(() => {
      if (introRunTokenRef.current !== introRunToken) {
        return;
      }

      setStage("split");

      const start = window.performance.now();
      const animatePhase = (now: number) => {
        if (introRunTokenRef.current !== introRunToken) {
          animationFrameRef.current = null;
          return;
        }

        const progress = Math.min(1, (now - start) / timeline.splitMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setPhase(eased);

        if (progress < 1) {
          animationFrameRef.current = window.requestAnimationFrame(animatePhase);
          return;
        }

        animationFrameRef.current = null;
        hasSettledIntroRef.current = true;
        setStage((currentStage) => (currentStage === "focus" ? currentStage : "idle"));
      };

      animationFrameRef.current = window.requestAnimationFrame(animatePhase);
    }, timeline.aggregateMs);

    return () => {
      cancelIntroMotion();
    };
  }, [
    focusedTopicSlug,
    reducedMotionPreference,
    timeline.aggregateMs,
    timeline.splitMs,
  ]);

  useEffect(() => {
    clearPendingFocusNavigation();
    setFocusedTopicSlug(selectedTopicSlug);
  }, [selectedTopicSlug]);

  useEffect(() => {
    if (!focusedTopicSlug) {
      setStage(hasSettledIntroRef.current ? "idle" : "aggregate");
      return;
    }

    const anchor = anchors.find((item) => item.topicSlug === focusedTopicSlug);
    if (!anchor) {
      return;
    }

    cancelIntroMotion();
    setPhase(1);
    setStage("focus");
  }, [anchors, focusedTopicSlug]);

  useEffect(() => {
    return () => {
      clearPendingFocusNavigation();
      cancelIntroMotion();
    };
  }, []);

  if (topics.length === 0) {
    return null;
  }

  const handleSelectTopic = (topicSlug: KnowledgeNebulaTopicSlug) => {
    const anchor = anchors.find((item) => item.topicSlug === topicSlug);
    if (!anchor) {
      return;
    }

    clearPendingFocusNavigation();
    cancelIntroMotion();
    hasSettledIntroRef.current = true;
    setFocusedTopicSlug(topicSlug);
    setPhase(1);
    setStage("focus");

    if (reducedMotionPreference || timeline.focusMs <= 0) {
      onSelectTopicRef.current(topicSlug);
      return;
    }

    const focusRunToken = focusRunTokenRef.current;
    focusTimeoutRef.current = window.setTimeout(() => {
      if (focusRunTokenRef.current !== focusRunToken) {
        return;
      }

      focusTimeoutRef.current = null;
      onSelectTopicRef.current(topicSlug);
    }, timeline.focusMs);
  };

  return (
    <div className="relative left-1/2 isolate h-dvh w-screen -translate-x-1/2 overflow-hidden px-0 pb-8 pt-24 sm:pb-10 sm:pt-28">
      <div className="pointer-events-none absolute inset-x-[5%] top-2 h-52 rounded-full bg-cyan-400/7 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-[8%] h-44 w-44 rounded-full bg-indigo-400/9 blur-3xl" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] [mask-image:linear-gradient(to_bottom,transparent,black_5%,black_96%,transparent)]"
      >
        {PARTICLE_STAR_LAYERS.map((layer) => (
          <motion.span
            key={layer.id}
            className="absolute left-0 top-0 rounded-full bg-white shadow-[0_0_8px_currentColor] will-change-opacity"
            style={{
              width: `${layer.size}px`,
              height: `${layer.size}px`,
              color: "white",
              boxShadow: layer.shadow,
              opacity: layer.opacity,
            }}
            animate={
              reducedMotionPreference
                ? undefined
                : {
                    opacity: [layer.opacity * 0.72, layer.opacity, layer.opacity * 0.82],
                  }
            }
            transition={{
              delay: layer.delay,
              duration: shouldAnimate ? layer.duration : 0.2,
              ease: "easeInOut",
              repeat: reducedMotionPreference ? 0 : repeat,
            }}
          />
        ))}
        {shootingStars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute h-[2px] origin-left rounded-full bg-gradient-to-r from-white via-cyan-100/80 to-transparent shadow-[0_0_18px_rgba(186,230,253,0.78)] will-change-transform"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.width}rem`,
              rotate: `${star.angle}deg`,
            }}
            initial={{ opacity: 0, x: 0, y: 0 }}
            animate={
              reducedMotionPreference
                ? undefined
                : {
                    opacity: [0, 0.96, 0.88, 0],
                    x: [
                      "0vw",
                      `${star.travelX * 0.2}vw`,
                      `${star.travelX * 0.78}vw`,
                      `${star.travelX}vw`,
                    ],
                    y: [
                      "0vh",
                      `${star.travelY * 0.2}vh`,
                      `${star.travelY * 0.78}vh`,
                      `${star.travelY}vh`,
                    ],
                  }
            }
            transition={{
              delay: star.delay,
              duration: shouldAnimate ? star.duration : 0.2,
              times: [0, 0.12, 0.72, 1],
              ease: "linear",
              repeat: reducedMotionPreference ? 0 : repeat,
              repeatDelay: star.repeatDelay,
            }}
          >
            <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_14px_4px_rgba(255,255,255,0.72)]" />
          </motion.span>
        ))}
      </div>

      <div className="relative z-30 mb-6 flex flex-col gap-3 px-6 text-center">
        <span className="mx-auto inline-flex items-center rounded-full border border-cyan-400/15 bg-cyan-400/8 px-3 py-1 text-[10px] font-mono tracking-[0.24em] text-cyan-200/75">
          KNOWLEDGE NEBULA
        </span>
        <h2 className="text-2xl font-light tracking-[0.24em] text-white sm:text-3xl">
          知识星云
        </h2>
        <p className="mx-auto max-w-[20rem] text-sm leading-relaxed text-slate-300/88 sm:max-w-2xl">
          在整片深空星幕中选择你想进入的主题星云
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 top-[11.75rem] mx-auto w-full overflow-hidden sm:top-[12.75rem]">
        {anchors.map((anchor, index) => {
          const variant =
            nebulaTextureVariants[index % nebulaTextureVariants.length];
          const isInteractive =
            hoveredTopicSlug === anchor.topicSlug ||
            focusedTopicSlug === anchor.topicSlug;
          const islandWidth =
            anchor.labelWidthRem *
            variant.widthMultiplier *
            (viewport === "mobile" ? 0.86 : 1);
          const opacity =
            variant.opacity *
            (anchor.depth === "near" ? 1.08 : anchor.depth === "mid" ? 0.96 : 0.88);
          const wrapperOpacity = Math.min(
            0.92,
            opacity * (isInteractive ? variant.hoverOpacityBoost : 1),
          );
          const wrapperScale = isInteractive ? variant.hoverScale : 1;

          return (
            <div
              key={`nebula-island-${anchor.topicSlug}`}
              aria-hidden="true"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${anchor.xPercent}%`,
                top: `${anchor.yPercent}%`,
                width: `${islandWidth}rem`,
              }}
            >
              <motion.div
                className="will-change-transform"
                initial={false}
                animate={
                  reducedMotionPreference
                    ? {
                        opacity: wrapperOpacity,
                        scale: wrapperScale,
                      }
                    : {
                        opacity: wrapperOpacity,
                        scale: wrapperScale,
                      }
                }
                transition={isInteractive ? NEBULA_HOVER_TRANSITION : NEBULA_IDLE_TRANSITION}
              >
                <motion.div
                  className="h-28 w-full rounded-full mix-blend-screen sm:h-40"
                  style={{
                    background: variant.background,
                    borderRadius: "9999px",
                    filter: variant.filter,
                    maskImage: variant.mask,
                    maskRepeat: "no-repeat",
                    maskSize: "100% 100%",
                    WebkitMaskImage: variant.mask,
                    WebkitMaskRepeat: "no-repeat",
                    WebkitMaskSize: "100% 100%",
                    transformOrigin: "50% 50%",
                  }}
                  initial={false}
                  animate={
                    reducedMotionPreference
                      ? {
                          rotate: variant.rotate,
                          scaleX: variant.scaleX,
                          scaleY: variant.scaleY,
                        }
                      : {
                          scaleX: [
                            variant.scaleX * 0.98,
                            variant.scaleX * (isInteractive ? 1.14 : 1.03),
                            variant.scaleX,
                          ],
                          scaleY: [
                            variant.scaleY * 1.02,
                            variant.scaleY * (isInteractive ? 1.16 : 0.98),
                            variant.scaleY,
                          ],
                          rotate: [
                            variant.rotate - 2,
                            variant.rotate + 2,
                            variant.rotate - 1,
                          ],
                        }
                  }
                  transition={{
                    duration: isInteractive
                      ? Math.max(3.8, variant.idleDuration - 2.2)
                      : variant.idleDuration,
                    ease: "easeInOut",
                    repeat: reducedMotionPreference ? 0 : repeat,
                  }}
                />
              </motion.div>
            </div>
          );
        })}

        {focusedAnchor ? (
          <>
            <motion.div
              key={`nebula-focus-warp-${focusedAnchor.topicSlug}`}
              aria-hidden="true"
              className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.7)_0%,rgba(186,230,253,0.4)_18%,rgba(244,114,182,0.26)_38%,transparent_68%)] mix-blend-screen will-change-transform"
              style={{
                left: `${focusedAnchor.xPercent}%`,
                top: `${focusedAnchor.yPercent}%`,
                width: `${focusedAnchor.labelWidthRem * 4.2}rem`,
                height: `${focusedAnchor.labelWidthRem * 4.2}rem`,
              }}
              initial={{ opacity: 0, scale: 0.24 }}
              animate={
                reducedMotionPreference
                  ? { opacity: 0, scale: 1 }
                  : {
                      opacity: [0, focusMotion.warpPeakOpacity, 0.4, 0],
                      scale: [
                        focusMotion.warpScaleStart,
                        1.1,
                        focusMotion.warpScaleMid,
                        focusMotion.warpScaleEnd,
                      ],
                    }
              }
              transition={{
                duration: Math.max(0.52, timeline.focusMs / 1000),
                ease: [0.12, 0.9, 0.22, 1],
              }}
            />
            <motion.div
              key={`nebula-focus-ring-${focusedAnchor.topicSlug}`}
              aria-hidden="true"
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70 shadow-[0_0_40px_rgba(186,230,253,0.55)] will-change-transform"
              style={{
                left: `${focusedAnchor.xPercent}%`,
                top: `${focusedAnchor.yPercent}%`,
                width: `${focusedAnchor.labelWidthRem * 1.55}rem`,
                height: `${focusedAnchor.labelWidthRem * 1.55}rem`,
              }}
              initial={{ opacity: 0, scale: 0.18 }}
              animate={
                reducedMotionPreference
                  ? { opacity: 0, scale: 1 }
                  : {
                      opacity: [0, focusMotion.ringPeakOpacity, 0.42, 0],
                      scale: [
                        focusMotion.ringScaleStart,
                        1.7,
                        focusMotion.ringScaleMid,
                        focusMotion.ringScaleEnd,
                      ],
                    }
              }
              transition={{
                duration: Math.max(0.48, timeline.focusMs / 1000),
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          </>
        ) : null}

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/12 bg-[radial-gradient(circle,rgba(186,230,253,0.22),rgba(34,211,238,0.08)_44%,transparent_72%)] blur-sm"
          animate={
            stage === "aggregate"
              ? reducedMotionPreference
                ? { opacity: 0.45, scale: 1 }
                : { opacity: [0.68, 0.92, 0.26], scale: [0.72, 1.18, 1.7] }
              : { opacity: 0, scale: 1.9 }
          }
          transition={{
            duration: reducedMotionPreference ? 0 : timeline.aggregateMs / 1000,
            ease: "easeOut",
          }}
        />

        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[18rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.16),rgba(14,116,144,0.12)_38%,transparent_74%)] blur-[58px]"
          animate={
            stage === "aggregate"
              ? reducedMotionPreference
                ? { opacity: 0.32, scaleX: 1, scaleY: 1 }
                : {
                    opacity: [0.72, 0.84, 0.18],
                    scaleX: [0.42, 0.96, 1.38],
                    scaleY: [0.34, 0.88, 1.22],
                  }
              : { opacity: 0, scaleX: 1.4, scaleY: 1.2 }
          }
          transition={{
            duration: reducedMotionPreference ? 0 : timeline.aggregateMs / 1000,
            ease: [0.22, 1, 0.36, 1],
          }}
        />

        <NebulaLabelLayer
          anchors={anchors}
          topicsBySlug={topicsBySlug}
          focusedTopicSlug={focusedTopicSlug}
          hoveredTopicSlug={hoveredTopicSlug}
          onHoverTopic={setHoveredTopicSlug}
          onSelectTopic={handleSelectTopic}
        />

        {/* <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-5 pb-5 pt-10 text-center">
          <p className="text-xs text-slate-300/78 sm:text-sm">
            {selectedTopic
              ? `镜头正在靠近：${selectedTopic.title}`
              : stage === "aggregate"
                ? "星空正在聚亮"
                : stage === "split"
                  ? "主题星云正在浮现"
                  : "选择任意主题星云，进入对应内容层"}
          </p>
        </div> */}
      </div>
    </div>
  );
}
