import { motion } from "motion/react";
import type {
  KnowledgeNebulaTopic,
  KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";

const NAV_ACCENT_CLASSES = {
  cyan: {
    active:
      "border-cyan-300/45 bg-cyan-400/16 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.2)]",
    idle:
      "border-cyan-400/12 bg-slate-950/35 text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-50",
    dot: "bg-cyan-300/90",
  },
  sky: {
    active:
      "border-sky-300/45 bg-sky-400/16 text-sky-50 shadow-[0_0_30px_rgba(56,189,248,0.2)]",
    idle:
      "border-sky-400/12 bg-slate-950/35 text-slate-300 hover:border-sky-300/30 hover:bg-sky-400/10 hover:text-sky-50",
    dot: "bg-sky-300/90",
  },
  indigo: {
    active:
      "border-indigo-300/45 bg-indigo-400/16 text-indigo-50 shadow-[0_0_30px_rgba(129,140,248,0.2)]",
    idle:
      "border-indigo-400/12 bg-slate-950/35 text-slate-300 hover:border-indigo-300/30 hover:bg-indigo-400/10 hover:text-indigo-50",
    dot: "bg-indigo-300/90",
  },
} as const;

export function KnowledgeNebulaTopicNav({
  topics,
  currentTopicSlug,
  onSelectTopic,
}: {
  topics: KnowledgeNebulaTopic[];
  currentTopicSlug: KnowledgeNebulaTopicSlug;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  return (
    <div className="glass-panel rounded-[1.75rem] border border-white/8 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono tracking-[0.28em] text-cyan-300/65">
            TOPIC MAP
          </p>
          <p className="mt-1 text-sm text-slate-300/85">
            当前主题高亮，其他主题可随时切换
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {topics.map((topic) => {
          const isCurrent = topic.slug === currentTopicSlug;
          const accent = NAV_ACCENT_CLASSES[topic.accent];

          return (
            <motion.button
              key={topic.slug}
              type="button"
              onClick={() => onSelectTopic(topic.slug)}
              className={[
                "group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                isCurrent ? accent.active : accent.idle,
              ].join(" ")}
              whileHover={isCurrent ? undefined : { y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full transition-transform",
                  accent.dot,
                  isCurrent ? "scale-110" : "opacity-70 group-hover:scale-110",
                ].join(" ")}
              />
              <span>{topic.shortLabel}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
