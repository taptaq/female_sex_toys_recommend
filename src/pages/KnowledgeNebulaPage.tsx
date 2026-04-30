import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaField } from "../components/KnowledgeNebulaField.tsx";
import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";

export function KnowledgeNebulaPage({
  pageVariants,
  topicSlug,
  onBack,
  onSelectTopic,
}: {
  pageVariants: any;
  topicSlug?: KnowledgeNebulaTopicSlug;
  onBack: () => void;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const topic = topicSlug ? getKnowledgeNebulaTopicBySlug(topicSlug) : undefined;
  const isDetailPage = topic != null;

  return (
    <motion.div
      key={topicSlug ? `knowledge-${topicSlug}` : "knowledge"}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={
        isDetailPage
          ? "w-full pb-6 sm:pb-8"
          : "relative h-dvh w-full overflow-hidden"
      }
    >
      <div
        className={
          isDetailPage
            ? "mb-4 px-1 sm:mb-5 sm:px-2"
            : "absolute left-4 top-4 z-50 sm:left-6 sm:top-6"
        }
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回上一层</span>
        </button>
      </div>

      {isDetailPage ? (
        <div className="space-y-6">
          <section className="glass-panel overflow-hidden rounded-[2rem] border border-white/8 p-6 sm:p-8">
            <div className="relative">
              <span className="inline-flex rounded-full border border-cyan-400/15 bg-cyan-400/8 px-3 py-1 text-[10px] font-mono tracking-[0.22em] text-cyan-200/75">
                TOPIC DETAIL
              </span>
              <h1 className="mt-4 text-3xl font-light tracking-[0.18em] text-white sm:text-4xl">
                {topic.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300/88 sm:text-base">
                {topic.summary}
              </p>
            </div>
          </section>

          <KnowledgeNebulaTopicSections topic={topic} />
        </div>
      ) : (
        <div>
          <KnowledgeNebulaField
            topics={KNOWLEDGE_NEBULA_TOPICS}
            selectedTopicSlug={topicSlug}
            onSelectTopic={onSelectTopic}
          />
        </div>
      )}
    </motion.div>
  );
}
