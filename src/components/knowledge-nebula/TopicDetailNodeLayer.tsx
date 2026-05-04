import { motion } from "motion/react";
import { Signal } from "lucide-react";
import type { KnowledgeNebulaSection } from "../../data/knowledge-nebula.ts";
import { usePagePerformanceState } from "../../lib/page-performance.ts";
import type {
  TopicDetailNodeAnchor,
  TopicDetailViewport,
} from "../../lib/knowledge-nebula-topic-detail-scene.ts";

type TopicDetailNodeLayerProps = {
  anchors: TopicDetailNodeAnchor[];
  sectionsById: Map<string, KnowledgeNebulaSection>;
  openSectionId: string | null;
  hoveredSectionId: string | null;
  viewport: TopicDetailViewport;
  onHoverSection: (sectionId: string | null) => void;
  onOpenSection: (sectionId: string) => void;
};

const COCKPIT_SCREEN_VISUAL_STYLE = {
  tone:
    "border-cyan-200/18 bg-[linear-gradient(145deg,rgba(5,24,38,0.72),rgba(2,9,20,0.91))] shadow-[0_0_48px_rgba(34,211,238,0.12)]",
  line: "from-cyan-200/46 via-cyan-100/14 to-transparent",
  text: "text-cyan-50",
  summary: "text-cyan-100/66",
} as const;

const SCREEN_SLOT_STYLES = {
  desktop: [
    {
      left: "9%",
      top: "24%",
      width: "min(22rem, 25vw)",
      hotWidth: "min(26rem, 29vw)",
      height: "clamp(8rem, 13.8vh, 9.3rem)",
      hotHeight: "clamp(9.2rem, 16vh, 10.8rem)",
      rotate: "-2deg",
      skew: "skewY(-1.5deg)",
    },
    {
      left: "68%",
      top: "27%",
      width: "min(21rem, 24vw)",
      hotWidth: "min(25rem, 28vw)",
      height: "clamp(7.9rem, 13.5vh, 9.1rem)",
      hotHeight: "clamp(9rem, 15.7vh, 10.6rem)",
      rotate: "2.4deg",
      skew: "skewY(1.2deg)",
    },
    {
      left: "36%",
      top: "36%",
      width: "min(21rem, 24vw)",
      hotWidth: "min(25rem, 28vw)",
      height: "clamp(7.8rem, 13.4vh, 9rem)",
      hotHeight: "clamp(9rem, 15.7vh, 10.6rem)",
      rotate: "-1.1deg",
      skew: "skewY(-0.8deg)",
    },
    {
      left: "8%",
      top: "53%",
      width: "min(18.5rem, 21vw)",
      hotWidth: "min(22rem, 24vw)",
      height: "clamp(7.5rem, 12.8vh, 8.6rem)",
      hotHeight: "clamp(8.5rem, 14.6vh, 9.8rem)",
      rotate: "3deg",
      skew: "skewY(1.6deg)",
    },
    {
      left: "69%",
      top: "52%",
      width: "min(19rem, 21.5vw)",
      hotWidth: "min(22.5rem, 25vw)",
      height: "clamp(7.6rem, 12.8vh, 8.7rem)",
      hotHeight: "clamp(8.6rem, 14.7vh, 9.9rem)",
      rotate: "-2.6deg",
      skew: "skewY(-1.1deg)",
    },
    {
      left: "42%",
      top: "63%",
      width: "min(18rem, 20vw)",
      hotWidth: "min(21.5rem, 23.5vw)",
      height: "clamp(7.2rem, 12.2vh, 8.3rem)",
      hotHeight: "clamp(8.2rem, 14vh, 9.5rem)",
      rotate: "1.7deg",
      skew: "skewY(0.8deg)",
    },
  ],
  mobile: [
    {
      left: "8%",
      top: "28%",
      width: "min(20rem, 84vw)",
      hotWidth: "min(20rem, 84vw)",
      height: "clamp(7.8rem, 15vh, 9rem)",
      hotHeight: "clamp(7.8rem, 15vh, 9rem)",
      rotate: "-1.5deg",
      skew: "skewY(-0.8deg)",
    },
    {
      left: "14%",
      top: "45%",
      width: "min(19rem, 80vw)",
      hotWidth: "min(19rem, 80vw)",
      height: "clamp(7.8rem, 15vh, 9rem)",
      hotHeight: "clamp(7.8rem, 15vh, 9rem)",
      rotate: "1.4deg",
      skew: "skewY(0.7deg)",
    },
    {
      left: "10%",
      top: "60%",
      width: "min(19rem, 82vw)",
      hotWidth: "min(19rem, 82vw)",
      height: "clamp(7.8rem, 15vh, 9rem)",
      hotHeight: "clamp(7.8rem, 15vh, 9rem)",
      rotate: "-0.8deg",
      skew: "skewY(-0.5deg)",
    },
    {
      left: "16%",
      top: "76%",
      width: "min(18rem, 76vw)",
      hotWidth: "min(18rem, 76vw)",
      height: "clamp(7.8rem, 15vh, 9rem)",
      hotHeight: "clamp(7.8rem, 15vh, 9rem)",
      rotate: "1deg",
      skew: "skewY(0.6deg)",
    },
  ],
} as const;

export function TopicDetailNodeLayer({
  anchors,
  sectionsById,
  openSectionId,
  hoveredSectionId,
  viewport,
  onHoverSection,
  onOpenSection,
}: TopicDetailNodeLayerProps) {
  const { repeat, shouldAnimate } = usePagePerformanceState();

  if (anchors.length === 0) {
    return null;
  }

  const slots = SCREEN_SLOT_STYLES[viewport];
  const heatRankBySectionId = new Map(
    anchors
      .map((anchor) => ({
        id: anchor.id,
        viewCount: sectionsById.get(anchor.id)?.viewCount ?? 0,
      }))
      .sort((left, right) => right.viewCount - left.viewCount)
      .map((entry, hotnessRank) => [entry.id, hotnessRank]),
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-label="驾驶舱知识屏">
      {anchors.map((anchor, index) => {
        const section = sectionsById.get(anchor.id);

        if (!section) {
          return null;
        }

        const slot = slots[index % slots.length];
        const isOpen = openSectionId === anchor.id;
        const isHovered = hoveredSectionId === anchor.id;
        const isActive = isOpen || isHovered;
        const viewCount = section.viewCount ?? 0;
        const hotnessRank = heatRankBySectionId.get(anchor.id) ?? index;
        const isHottest = hotnessRank === 0 && viewCount > 0;
        const isHighHeat = viewCount > 0 && hotnessRank <= 1;
        const widthBoost =
          viewport === "desktop" && isHighHeat ? slot.hotWidth : slot.width;
        const heightBoost =
          viewport === "desktop" && isHighHeat ? slot.hotHeight : slot.height;
        const floatY = 3 + (index % 3) * 1.4;
        return (
          <motion.button
            key={anchor.id}
            type="button"
            className={[
              "cockpit-screen group pointer-events-auto absolute cursor-pointer overflow-hidden rounded-[1.1rem] border px-4 py-3.5 text-left backdrop-blur-xl transition-[border-color,filter,box-shadow,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:rounded-[1.35rem] sm:px-5",
              COCKPIT_SCREEN_VISUAL_STYLE.tone,
              isHottest ? "high-heat shadow-[0_0_76px_rgba(125,211,252,0.22)]" : "",
              isHighHeat ? "border-cyan-100/30" : "",
              isActive ? "brightness-125" : "brightness-95 hover:brightness-110",
            ].join(" ")}
            style={{
              left: slot.left,
              top: slot.top,
              width: widthBoost,
              height: heightBoost,
              rotate: slot.rotate,
              transform: slot.skew,
              zIndex: isOpen ? 36 : isHovered ? 34 : isHottest ? 32 : 24 + index,
            }}
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{
              opacity: isActive ? 1 : 0.9,
              scale: 1,
              y: isActive ? -6 : shouldAnimate ? [0, -floatY, 0] : 0,
            }}
            transition={{
              opacity: { duration: 0.24, ease: "easeOut" },
              scale: { duration: 0.24, ease: "easeOut" },
              y: {
                duration: isActive || !shouldAnimate ? 0.22 : 2.8 + (index % 3) * 0.38,
                ease: "easeInOut",
                repeat: isActive ? 0 : repeat,
                repeatType: "mirror",
                delay: index * 0.1,
              },
            }}
            whileHover={{ y: -8, scale: 1.018 }}
            whileFocus={{ y: -8, scale: 1.018 }}
            whileTap={{ scale: 0.985, y: -3 }}
            onMouseEnter={() => onHoverSection(anchor.id)}
            onMouseLeave={() => onHoverSection(null)}
            onFocus={() => onHoverSection(anchor.id)}
            onBlur={() => onHoverSection(null)}
            onClick={() => onOpenSection(anchor.id)}
            aria-label={`打开屏幕 ${anchor.title}`}
            aria-pressed={isOpen}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),transparent_34%),repeating-linear-gradient(180deg,rgba(125,211,252,0.055)_0_1px,transparent_1px_6px)] opacity-70" />
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <div className="absolute -right-8 top-2 h-20 w-20 rounded-full bg-cyan-200/10 blur-2xl" />
            </div>
            <div
              className={[
                "pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r",
                COCKPIT_SCREEN_VISUAL_STYLE.line,
              ].join(" ")}
            />
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-200/8 blur-2xl" />
            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center justify-between gap-4 text-[10px] tracking-[0.2em] text-white/38">
                <span>PARAM {String(index + 1).padStart(2, "0")}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Signal className="h-3 w-3" />
                  <span>热度信号 {viewCount}</span>
                </span>
              </div>
              <h3
                className={`mt-3 line-clamp-1 min-h-[1.6rem] text-base font-medium leading-[1.6] sm:text-lg sm:leading-[1.55] ${COCKPIT_SCREEN_VISUAL_STYLE.text}`}
              >
                {anchor.title}
              </h3>
              <div className="cockpit-title-divider my-2.5 h-px w-full bg-gradient-to-r from-cyan-100/42 via-cyan-100/18 to-transparent opacity-80" />
              <p
                className={[
                  "min-h-[1.45rem] text-xs leading-[1.65] sm:text-sm sm:leading-[1.6]",
                  "line-clamp-1",
                  COCKPIT_SCREEN_VISUAL_STYLE.summary,
                ].join(" ")}
              >
                {section.summary}
              </p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
