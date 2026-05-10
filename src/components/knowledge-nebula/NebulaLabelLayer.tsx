import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../../data/knowledge-nebula.ts";
import type { KnowledgeNebulaClusterAnchor } from "../../lib/knowledge-nebula-field.ts";

type NebulaLabelLayerProps = {
  anchors: KnowledgeNebulaClusterAnchor[];
  topicsBySlug: ReadonlyMap<KnowledgeNebulaTopicSlug, KnowledgeNebulaTopic>;
  focusedTopicSlug?: KnowledgeNebulaTopicSlug;
  hoveredTopicSlug?: KnowledgeNebulaTopicSlug;
  onHoverTopic: (slug?: KnowledgeNebulaTopicSlug) => void;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
};

const ACCENT_STYLES: Record<
  KnowledgeNebulaTopic["accent"],
  {
    glow: string;
  }
> = {
  cyan: {
    glow: "drop-shadow-[0_0_18px_rgba(103,232,249,0.46)]",
  },
  sky: {
    glow: "drop-shadow-[0_0_18px_rgba(125,211,252,0.42)]",
  },
  indigo: {
    glow: "drop-shadow-[0_0_18px_rgba(165,180,252,0.44)]",
  },
};

const DEPTH_Z_INDEX = {
  near: "z-30",
  mid: "z-20",
  far: "z-10",
} as const;

export function NebulaLabelLayer({
  anchors,
  topicsBySlug,
  focusedTopicSlug,
  hoveredTopicSlug,
  onHoverTopic,
  onSelectTopic,
}: NebulaLabelLayerProps) {
  return (
    <div className="absolute inset-0 z-20">
      {anchors.map((anchor, index) => {
        const topic = topicsBySlug.get(anchor.topicSlug);
        if (!topic) {
          return null;
        }

        const accent = ACCENT_STYLES[topic.accent];
        const isFocused = focusedTopicSlug === topic.slug;
        const isHovered = hoveredTopicSlug === topic.slug;

        return (
          <button
            key={topic.slug}
            type="button"
            onClick={() => onSelectTopic(topic.slug)}
            onFocus={() => onHoverTopic(topic.slug)}
            onBlur={() => onHoverTopic(undefined)}
            onMouseEnter={() => onHoverTopic(topic.slug)}
            onMouseLeave={() => onHoverTopic(undefined)}
            className={[
              "group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer px-2.5 py-2.5 text-center transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-3 sm:py-2",
              DEPTH_Z_INDEX[anchor.depth],
              accent.glow,
              isFocused
                ? "scale-105 opacity-100"
                : isHovered
                  ? "scale-[1.06] opacity-100"
                  : "opacity-[0.86] hover:opacity-100",
            ].join(" ")}
            style={{
              left: `${anchor.xPercent}%`,
              top: `${anchor.yPercent}%`,
              width: `${anchor.labelWidthRem}rem`,
            }}
            aria-label={`进入 ${topic.title}`}
          >
            <span
              className="text-[9px] font-mono tracking-[0.24em] text-[rgb(103,232,249)] sm:text-[10px] sm:tracking-[0.28em]"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3
              className="mt-1.5 text-[13px] font-medium tracking-[0.12em] text-[rgb(103,232,249)] sm:mt-2 sm:text-base sm:tracking-[0.14em]"
            >
              {topic.title}
            </h3>
            <p className="mt-1 text-[10px] leading-[1.55] text-[rgb(103,232,249)] sm:text-xs">
              {isFocused ? "正在穿入这片星云" : "进入主题"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
