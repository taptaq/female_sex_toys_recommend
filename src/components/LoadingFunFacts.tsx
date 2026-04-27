import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  getNextLoadingFunFactIndex,
  type LoadingFunFact,
} from "../lib/loading-fun-facts.ts";

export function LoadingFunFacts({
  facts,
  title = "等待的时候，顺手看一条",
  eyebrow = "趣味知识",
  intervalMs = 3600,
  className = "",
}: {
  facts: LoadingFunFact[];
  title?: string;
  eyebrow?: string;
  intervalMs?: number;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [facts]);

  useEffect(() => {
    if (facts.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        getNextLoadingFunFactIndex(currentIndex, facts.length),
      );
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [facts, intervalMs]);

  const activeFact = facts[activeIndex] ?? facts[0];

  if (!activeFact) {
    return null;
  }

  return (
    <div
      className={`loading-fun-fact-shell glass-panel rounded-3xl p-4 sm:p-5 text-left ${className}`.trim()}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono tracking-[0.28em] text-cyan-300/70 uppercase">
            {eyebrow}
          </p>
          <p className="mt-1 text-sm sm:text-[15px] font-medium text-white/90">
            {title}
          </p>
        </div>
        <div className="rounded-full border border-cyan-400/15 bg-cyan-400/8 px-2.5 py-1 text-[10px] font-mono tracking-[0.2em] text-cyan-200/70">
          {String(activeIndex + 1).padStart(2, "0")} /{" "}
          {String(facts.length).padStart(2, "0")}
        </div>
      </div>

      <div
        aria-live="polite"
        className="loading-fun-fact-stage relative overflow-hidden rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-4 sm:px-5"
      >
        <div className="loading-fun-fact-orb" aria-hidden="true" />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFact.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative z-10 min-h-[98px] sm:min-h-[88px]"
          >
            <p className="text-base sm:text-lg font-semibold tracking-[0.02em] text-white">
              {activeFact.title}
            </p>
            <p className="mt-2 text-sm sm:text-[15px] leading-6 text-slate-300">
              {activeFact.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {facts.map((fact, index) => (
            <span
              key={fact.id}
              className={
                index === activeIndex
                  ? "loading-fun-fact-dot loading-fun-fact-dot-active"
                  : "loading-fun-fact-dot"
              }
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-400">为你整理一点实用又不无聊的小参考</p>
      </div>
    </div>
  );
}
