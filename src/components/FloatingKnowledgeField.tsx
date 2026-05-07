import { motion } from "motion/react";
import {
  buildFloatingKnowledgeItems,
  type FloatingKnowledgeVariant,
  type FloatingKnowledgeViewport,
} from "../lib/floating-knowledge-field.ts";
import type { LoadingFunFact } from "../lib/loading-fun-facts.ts";
import {
  getFloatingKnowledgeItemBudget,
  shouldEnableFloatingKnowledgePointerEffects,
} from "../lib/knowledge-nebula-performance.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

export function FloatingKnowledgeField({
  facts,
  variant,
  className = "",
}: {
  facts: LoadingFunFact[];
  variant: FloatingKnowledgeVariant;
  className?: string;
}) {
  const { isVisible, prefersReducedMotion, shouldAnimate } = usePagePerformanceState();
  const hasFinePointer =
    typeof window !== "undefined" &&
    "matchMedia" in window &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const shouldFloat = shouldAnimate;
  const shouldEnablePointerEffects = shouldEnableFloatingKnowledgePointerEffects({
    isVisible,
    prefersReducedMotion,
    hasFinePointer,
  });
  const buildBudgetedItems = (viewport: FloatingKnowledgeViewport) =>
    buildFloatingKnowledgeItems(facts, {
      variant,
        viewport,
        maxItems: getFloatingKnowledgeItemBudget({
          variant,
          viewport,
          isVisible,
          prefersReducedMotion,
        }),
      });
  const mobileItems = buildBudgetedItems("mobile");
  const budgetedDesktopItems = buildBudgetedItems("desktop");

  if (budgetedDesktopItems.length === 0 && mobileItems.length === 0) {
    return null;
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!shouldEnablePointerEffects) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const offsetY = (event.clientY - bounds.top) / bounds.height - 0.5;

    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-x",
      `${(offsetX * 12).toFixed(2)}px`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-y",
      `${(offsetY * 12).toFixed(2)}px`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-rotate-x",
      `${(-offsetY * 5).toFixed(2)}deg`,
    );
    event.currentTarget.style.setProperty(
      "--floating-knowledge-hover-rotate-y",
      `${(offsetX * 7).toFixed(2)}deg`,
    );
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--floating-knowledge-hover-x", "0px");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-y", "0px");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-rotate-x", "0deg");
    event.currentTarget.style.setProperty("--floating-knowledge-hover-rotate-y", "0deg");
  };

  return (
    <div
      className={`floating-knowledge-field floating-knowledge-field-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      {[...budgetedDesktopItems, ...mobileItems].map((item, index) => {
        const isMobileLayer = index >= budgetedDesktopItems.length;
        const layerClassName = isMobileLayer
          ? "floating-knowledge-mobile-only"
          : "floating-knowledge-desktop-only";
        const targetOpacity =
          variant === "matching"
            ? item.slot.depth === "near"
              ? isMobileLayer
                ? 0.62
                : 0.72
              : isMobileLayer
                ? 0.46
                : 0.52
            : item.slot.depth === "near"
              ? isMobileLayer
                ? 0.7
                : 0.8
              : isMobileLayer
                ? 0.54
                : 0.58;

        return (
          <motion.div
            key={`${layerClassName}-${item.fact.id}-${item.slot.id}`}
            className={[
              "floating-knowledge-capsule",
              `floating-knowledge-capsule-${item.slot.depth}`,
              item.slot.className,
              item.slot.shapeClassName,
              shouldFloat ? item.slot.motionClassName : "",
              layerClassName,
            ].join(" ")}
            initial={{ opacity: 0 }}
            animate={{ opacity: shouldFloat ? targetOpacity : targetOpacity * 0.82 }}
            whileHover={{
              opacity: !shouldFloat
                ? Math.min(targetOpacity * 0.98, 0.94)
                : Math.min(targetOpacity + 0.24, 0.94),
            }}
            transition={{
              duration: shouldFloat ? 0.7 : 0.16,
              delay: shouldFloat ? item.slot.delayMs / 1000 : 0,
              ease: "easeOut",
            }}
            onPointerMove={shouldEnablePointerEffects ? handlePointerMove : undefined}
            onPointerLeave={shouldEnablePointerEffects ? handlePointerLeave : undefined}
          >
            <span>{item.fact.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
