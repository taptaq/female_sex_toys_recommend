import { motion, useReducedMotion } from "motion/react";
import {
  buildFloatingKnowledgeItems,
  type FloatingKnowledgeVariant,
} from "../lib/floating-knowledge-field.ts";
import type { LoadingFunFact } from "../lib/loading-fun-facts.ts";

export function FloatingKnowledgeField({
  facts,
  variant,
  className = "",
}: {
  facts: LoadingFunFact[];
  variant: FloatingKnowledgeVariant;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const desktopItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "desktop",
  });
  const mobileItems = buildFloatingKnowledgeItems(facts, {
    variant,
    viewport: "mobile",
  });

  if (desktopItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`floating-knowledge-field floating-knowledge-field-${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      {[...desktopItems, ...mobileItems].map((item, index) => {
        const isMobileLayer = index >= desktopItems.length;
        const layerClassName = isMobileLayer
          ? "floating-knowledge-mobile-only"
          : "floating-knowledge-desktop-only";
        const targetOpacity =
          item.slot.depth === "near"
            ? isMobileLayer
              ? 0.58
              : 0.72
            : isMobileLayer
              ? 0.34
              : 0.42;

        return (
          <motion.div
            key={`${layerClassName}-${item.fact.id}-${item.slot.id}`}
            className={[
              "floating-knowledge-capsule",
              `floating-knowledge-capsule-${item.slot.depth}`,
              item.slot.className,
              layerClassName,
            ].join(" ")}
            initial={{ opacity: 0 }}
            animate={{ opacity: prefersReducedMotion ? targetOpacity * 0.9 : targetOpacity }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 0.7,
              delay: prefersReducedMotion ? 0 : item.slot.delayMs / 1000,
              ease: "easeOut",
            }}
          >
            <span>{item.fact.title}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
