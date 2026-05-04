import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  KNOWLEDGE_NEBULA_TOPICS,
  getKnowledgeNebulaTopicBySlug,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";
import { KnowledgeNebulaField } from "../components/KnowledgeNebulaField.tsx";
import { KnowledgeNebulaTopicSections } from "../components/KnowledgeNebulaTopicSections.tsx";
import { TopicDetailScene3D } from "../components/knowledge-nebula/TopicDetailScene3D.tsx";
import {
  buildTopicDetailSceneMeta,
  getTopicDetailViewport,
  type TopicDetailViewport,
} from "../lib/knowledge-nebula-topic-detail-scene.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

const DETAIL_ACCENTS = {
  cyan: {
    soft: "bg-cyan-400/10",
    line: "from-cyan-300/80 via-cyan-200/30 to-transparent",
    text: "from-white via-cyan-100 to-cyan-300/75",
    border: "border-cyan-300/18",
    chip: "border-cyan-300/16 bg-cyan-400/8 text-cyan-100/82",
    glow: "from-cyan-400/24 via-cyan-300/10 to-transparent",
  },
  sky: {
    soft: "bg-sky-400/10",
    line: "from-sky-300/80 via-sky-200/30 to-transparent",
    text: "from-white via-sky-100 to-sky-300/75",
    border: "border-sky-300/18",
    chip: "border-sky-300/16 bg-sky-400/8 text-sky-100/82",
    glow: "from-sky-400/24 via-sky-300/10 to-transparent",
  },
  indigo: {
    soft: "bg-indigo-400/10",
    line: "from-indigo-300/80 via-indigo-200/30 to-transparent",
    text: "from-white via-indigo-100 to-indigo-300/75",
    border: "border-indigo-300/18",
    chip: "border-indigo-300/16 bg-indigo-400/8 text-indigo-100/82",
    glow: "from-indigo-400/24 via-indigo-300/10 to-transparent",
  },
} as const;

function useTopicDetailViewport(): TopicDetailViewport {
  const [viewport, setViewport] = useState<TopicDetailViewport>(() =>
    getTopicDetailViewport(),
  );

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

  return viewport;
}

export function KnowledgeNebulaPage({
  pageVariants,
  topicSlug,
  sectionId,
  onBack,
  onSelectTopic,
}: {
  pageVariants: any;
  topicSlug?: KnowledgeNebulaTopicSlug;
  sectionId?: string;
  onBack: () => void;
  onSelectTopic: (slug: KnowledgeNebulaTopicSlug) => void;
}) {
  const topic = topicSlug ? getKnowledgeNebulaTopicBySlug(topicSlug) : undefined;
  const { shouldAnimate } = usePagePerformanceState();
  const isDetailPage = topic != null;
  const detailAccent = topic ? DETAIL_ACCENTS[topic.accent] : DETAIL_ACCENTS.cyan;
  const detailViewport = useTopicDetailViewport();
  const detailSceneMeta = useMemo(
    () => (topic ? buildTopicDetailSceneMeta(topic) : undefined),
    [topic],
  );

  useEffect(() => {
    if (!isDetailPage || typeof document === "undefined") {
      return undefined;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlHeight = documentElement.style.height;

    body.style.overflow = "hidden";
    body.style.height = "100dvh";
    documentElement.style.overflow = "hidden";
    documentElement.style.height = "100dvh";

    return () => {
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.height = previousHtmlHeight;
    };
  }, [isDetailPage]);

  return (
    <motion.div
      key={topicSlug ? `knowledge-${topicSlug}` : "knowledge"}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        isDetailPage
          ? "knowledge-detail-viewport fixed inset-0 h-[100dvh] w-screen overflow-hidden"
          : "relative h-dvh w-full overflow-hidden",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div
        className={
          isDetailPage
            ? "absolute left-4 top-4 z-50 sm:left-6 sm:top-6"
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
        <section className="relative isolate h-[100dvh] overflow-hidden bg-[#030612]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgba(125,211,252,0.08),transparent_40%),radial-gradient(ellipse_at_18%_72%,rgba(129,140,248,0.08),transparent_35%),linear-gradient(180deg,rgba(4,7,18,0.88),rgba(1,3,12,0.98))]" />
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_10%_18%,rgba(255,255,255,0.44)_0_1px,transparent_1.5px),radial-gradient(circle_at_76%_10%,rgba(125,211,252,0.38)_0_1px,transparent_1.5px),radial-gradient(circle_at_88%_72%,rgba(255,255,255,0.24)_0_1px,transparent_1.5px),radial-gradient(circle_at_42%_84%,rgba(103,232,249,0.26)_0_1px,transparent_1.5px)] [background-size:170px_170px,230px_230px,190px_190px,260px_260px]" />
            <div className="cockpit-cruise-field pointer-events-none absolute inset-0 overflow-hidden">
              <div className="cockpit-cruise-stars cockpit-cruise-stars-a absolute inset-[-12%]" />
              <div className="cockpit-cruise-stars cockpit-cruise-stars-b absolute inset-[-18%]" />
              <div className="cockpit-cruise-depth absolute inset-[-8%]">
                <div className="cockpit-cruise-dust cockpit-cruise-dust-a absolute inset-0" />
                <div className="cockpit-cruise-dust cockpit-cruise-dust-b absolute inset-0" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-a absolute left-[58%] top-[18%] h-px w-[26vw] rotate-[-10deg]" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-b absolute left-[8%] top-[45%] h-px w-[34vw] rotate-[-12deg]" />
                <div className="cockpit-cruise-speedline cockpit-cruise-speedline-c absolute left-[46%] top-[72%] h-px w-[30vw] rotate-[-14deg]" />
              </div>
              <div className="cockpit-cruise-stream cockpit-cruise-stream-a absolute left-[-12%] top-[24%] h-px w-[42vw] rotate-[-13deg]" />
              <div className="cockpit-cruise-stream cockpit-cruise-stream-b absolute right-[-16%] top-[58%] h-px w-[48vw] rotate-[-17deg]" />
              <div className="cockpit-cruise-beacon absolute left-[18%] top-[18%] h-1 w-1 rounded-full bg-cyan-100/70" />
            </div>
            {detailSceneMeta ? (
              <TopicDetailScene3D
                topicSlug={topic.slug}
                nodeCount={topic.sections.length}
                meta={detailSceneMeta}
                viewport={detailViewport}
                className="pointer-events-none opacity-95"
              />
            ) : null}
            <div className="absolute inset-0 z-10">
              <KnowledgeNebulaTopicSections
                topic={topic}
                initialOpenSectionId={sectionId}
              />
            </div>
        </section>
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
