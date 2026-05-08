import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Signal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  KnowledgeNebulaSection,
  KnowledgeNebulaTopic,
} from "../data/knowledge-nebula.ts";
import {
  buildTopicDetailNodeAnchors,
  getTopicDetailViewport,
  type TopicDetailViewport,
} from "../lib/knowledge-nebula-topic-detail-scene.ts";
import { mergeKnowledgeNebulaTopicPayload } from "../lib/knowledge-nebula-topic-sync.ts";
import { TopicDetailNodeLayer } from "./knowledge-nebula/TopicDetailNodeLayer.tsx";

type KnowledgeCardEditorState = {
  mode: "create" | "edit";
  cardId?: string;
  title: string;
  summary: string;
  bodyText: string;
  sourceUrl: string;
  tagsText: string;
  isFeatured: boolean;
  isSubmitting: boolean;
  error: string | null;
};

const ACCENT_STYLES = {
  cyan: {
    badge: "border-cyan-300/16 bg-cyan-400/10 text-cyan-100/82",
    title: "from-white via-cyan-100 to-cyan-300/78",
    summary: "text-cyan-50/78",
    glow: "from-cyan-300/18 via-cyan-200/10 to-transparent",
    dialogBorder: "border-cyan-300/16",
    dialogGlow: "shadow-[0_0_120px_rgba(34,211,238,0.12)]",
    dialogTag: "border-cyan-300/14 bg-cyan-400/8 text-cyan-100/85",
  },
  sky: {
    badge: "border-sky-300/16 bg-sky-400/10 text-sky-100/82",
    title: "from-white via-sky-100 to-sky-300/78",
    summary: "text-sky-50/78",
    glow: "from-sky-300/18 via-sky-200/10 to-transparent",
    dialogBorder: "border-sky-300/16",
    dialogGlow: "shadow-[0_0_120px_rgba(56,189,248,0.12)]",
    dialogTag: "border-sky-300/14 bg-sky-400/8 text-sky-100/85",
  },
  indigo: {
    badge: "border-indigo-300/16 bg-indigo-400/10 text-indigo-100/82",
    title: "from-white via-indigo-100 to-indigo-300/78",
    summary: "text-indigo-50/78",
    glow: "from-indigo-300/18 via-indigo-200/10 to-transparent",
    dialogBorder: "border-indigo-300/16",
    dialogGlow: "shadow-[0_0_120px_rgba(129,140,248,0.12)]",
    dialogTag: "border-indigo-300/14 bg-indigo-400/8 text-indigo-100/85",
  },
} as const;

const COCKPIT_SCREEN_GROUP_SIZE = {
  desktop: 6,
  mobile: 4,
} as const;

const KNOWLEDGE_CARD_VIEWER_KEY = "inner-space-knowledge-card-viewer";

function createKnowledgeCardViewerKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `viewer-${crypto.randomUUID()}`;
  }

  return `viewer-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getKnowledgeCardViewerKey() {
  if (typeof window === "undefined") {
    return "server-rendered-viewer";
  }

  const existingViewerKey = window.localStorage.getItem(KNOWLEDGE_CARD_VIEWER_KEY);
  if (existingViewerKey) {
    return existingViewerKey;
  }

  const nextViewerKey = createKnowledgeCardViewerKey();
  window.localStorage.setItem(KNOWLEDGE_CARD_VIEWER_KEY, nextViewerKey);
  return nextViewerKey;
}

export function KnowledgeNebulaTopicSections({
  topic,
  isAdmin = false,
  initialOpenSectionId,
}: {
  topic: KnowledgeNebulaTopic;
  isAdmin?: boolean;
  initialOpenSectionId?: string;
}) {
  const [liveTopic, setLiveTopic] = useState(topic);
  const [topicSyncError, setTopicSyncError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<TopicDetailViewport>(() =>
    getTopicDetailViewport(),
  );
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [openSectionId, setOpenSectionId] = useState<string | null>(
    initialOpenSectionId ?? null,
  );
  const [viewedSectionIds, setViewedSectionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [visibleScreenStart, setVisibleScreenStart] = useState(0);
  const [editorState, setEditorState] = useState<KnowledgeCardEditorState | null>(
    null,
  );

  const accent = ACCENT_STYLES[liveTopic.accent];
  const sectionsById = useMemo(
    () => new Map(liveTopic.sections.map((section) => [section.id, section])),
    [liveTopic.sections],
  );
  const featuredIds = useMemo(
    () => new Set(liveTopic.featuredSectionIds),
    [liveTopic.featuredSectionIds],
  );
  const anchors = useMemo(
    () =>
      buildTopicDetailNodeAnchors({
        topic: liveTopic,
        viewport,
      }),
    [liveTopic, viewport],
  );
  const currentScreenGroupSize = COCKPIT_SCREEN_GROUP_SIZE[viewport];
  const visibleAnchors = useMemo(
    () => anchors.slice(visibleScreenStart, visibleScreenStart + currentScreenGroupSize),
    [anchors, currentScreenGroupSize, visibleScreenStart],
  );
  const screenGroupIndex = Math.floor(visibleScreenStart / currentScreenGroupSize) + 1;
  const screenGroupTotal = Math.max(
    1,
    Math.ceil(anchors.length / currentScreenGroupSize),
  );
  const canPageScreens = anchors.length > currentScreenGroupSize;
  const openSection = openSectionId ? sectionsById.get(openSectionId) : undefined;
  const relatedSections = openSection
    ? (openSection.relatedSectionIds?.length
        ? openSection.relatedSectionIds
            .map((sectionId) => sectionsById.get(sectionId))
            .filter((section): section is KnowledgeNebulaSection => Boolean(section))
        : liveTopic.sections.filter((section) => section.id !== openSection.id)
      ).slice(0, 3)
    : [];

  useEffect(() => {
    setLiveTopic(topic);
    setHoveredSectionId(null);
    setOpenSectionId(initialOpenSectionId ?? null);
    setViewedSectionIds(new Set());
    setVisibleScreenStart(0);
    setEditorState(null);
    setTopicSyncError(null);
  }, [initialOpenSectionId, topic]);

  useEffect(() => {
    setVisibleScreenStart((current) => {
      if (anchors.length === 0) {
        return 0;
      }

      const maxStart =
        Math.max(0, Math.ceil(anchors.length / currentScreenGroupSize) - 1) *
        currentScreenGroupSize;

      return Math.min(current, maxStart);
    });
  }, [anchors.length, currentScreenGroupSize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const onChange = (event: MediaQueryListEvent) => {
      setViewport(event.matches ? "desktop" : "mobile");
    };

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!openSectionId || sectionsById.has(openSectionId)) {
      return;
    }

    setOpenSectionId(null);
  }, [openSectionId, sectionsById]);

  useEffect(() => {
    let cancelled = false;

    const syncTopic = async () => {
      try {
        const response = await fetch(`/api/knowledge/topics/${topic.slug}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || payload?.details || `HTTP ${response.status}`);
        }

        const payload = (await response.json()) as KnowledgeNebulaTopic;
        if (!cancelled) {
          setLiveTopic((current) =>
            mergeKnowledgeNebulaTopicPayload(current, payload),
          );
          setTopicSyncError(null);
        }
      } catch (_error) {
        if (!cancelled) {
          setTopicSyncError("数据库内容同步失败，当前展示本地卡片。");
        }
      }
    };

    void syncTopic();

    return () => {
      cancelled = true;
    };
  }, [topic.slug]);

  useEffect(() => {
    if (!openSectionId) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSectionId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openSectionId]);

  const openCreateEditor = () => {
    setEditorState({
      mode: "create",
      title: "",
      summary: "",
      bodyText: "",
      sourceUrl: "",
      tagsText: "",
      isFeatured: false,
      isSubmitting: false,
      error: null,
    });
  };

  const openEditEditor = (section: KnowledgeNebulaSection) => {
    setEditorState({
      mode: "edit",
      cardId: section.id,
      title: section.title,
      summary: section.summary,
      bodyText: section.body.join("\n\n"),
      sourceUrl: section.sourceUrl ?? "",
      tagsText: (section.tags ?? []).join(", "),
      isFeatured: featuredIds.has(section.id),
      isSubmitting: false,
      error: null,
    });
  };

  const updateEditorField = (
    field: keyof Omit<
      KnowledgeCardEditorState,
      "mode" | "cardId" | "isSubmitting" | "error"
    >,
    value: string | boolean,
  ) => {
    setEditorState((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  };

  const closeEditor = () => {
    setEditorState(null);
  };

  const showPreviousScreenGroup = () => {
    setVisibleScreenStart((current) =>
      Math.max(0, current - currentScreenGroupSize),
    );
  };

  const showNextScreenGroup = () => {
    setVisibleScreenStart((current) => {
      const nextStart = current + currentScreenGroupSize;

      if (nextStart >= anchors.length) {
        return 0;
      }

      return nextStart;
    });
  };

  const patchSectionViewCount = (sectionId: string, viewCount: number) => {
    setLiveTopic((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              viewCount,
            }
          : section,
      ),
    }));
  };

  const recordCardView = async (sectionId: string) => {
    const currentSection = sectionsById.get(sectionId);
    const hasViewedInSession = viewedSectionIds.has(sectionId);
    if (!hasViewedInSession) {
      const optimisticViewCount = (currentSection?.viewCount ?? 0) + 1;
      patchSectionViewCount(sectionId, optimisticViewCount);
      setViewedSectionIds((current) => new Set(current).add(sectionId));
    }

    try {
      const viewerKey = getKnowledgeCardViewerKey();
      const response = await fetch(`/api/knowledge/cards/${sectionId}/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ viewerKey }),
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        cardId?: string;
        viewCount?: number;
        counted?: boolean;
      };
      if (
        payload.cardId === sectionId &&
        typeof payload.viewCount === "number"
      ) {
        patchSectionViewCount(sectionId, payload.viewCount);
      }
    } catch (_error) {
      // 热度记录是增强信息，失败时不阻塞主屏展开。
    }
  };

  const openParameterScreen = (sectionId: string) => {
    setOpenSectionId(sectionId);
    void recordCardView(sectionId);
  };

  const saveEditor = async () => {
    if (!editorState || editorState.isSubmitting) {
      return;
    }

    const payload = {
      title: editorState.title,
      summary: editorState.summary,
      bodyText: editorState.bodyText,
      sourceUrl: editorState.sourceUrl,
      tags: editorState.tagsText,
      isFeatured: editorState.isFeatured,
    };

    setEditorState((current) =>
      current
        ? {
            ...current,
            isSubmitting: true,
            error: null,
          }
        : current,
    );

    try {
      const path =
        editorState.mode === "create"
          ? `/api/knowledge/topics/${liveTopic.slug}/cards`
          : `/api/knowledge/cards/${editorState.cardId}`;
      const method = editorState.mode === "create" ? "POST" : "PATCH";
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          errorPayload?.error ||
            errorPayload?.details ||
            `HTTP ${response.status}`,
        );
      }

      const nextTopic = (await response.json()) as KnowledgeNebulaTopic;
      setLiveTopic((current) =>
        mergeKnowledgeNebulaTopicPayload(current, nextTopic),
      );
      setTopicSyncError(null);
      setEditorState(null);
    } catch (error) {
      setEditorState((current) =>
        current
          ? {
              ...current,
              isSubmitting: false,
              error: String(error),
            }
          : current,
      );
    }
  };

  return (
    <>
      <div className="relative h-full min-h-0 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[28dvh] bg-[linear-gradient(180deg,rgba(0,8,18,0.58),transparent)]" />
        <div className="pointer-events-none absolute left-1/2 top-[13dvh] z-10 h-[38dvh] w-[86vw] -translate-x-1/2 rounded-[50%] border-t border-cyan-100/12 shadow-[inset_0_34px_90px_rgba(8,47,73,0.12)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[32dvh] bg-[linear-gradient(180deg,transparent,rgba(1,6,16,0.72)_28%,rgba(1,4,12,0.98))]" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-[30dvh] w-[112vw] -translate-x-1/2 rounded-t-[52%] border-t border-cyan-100/12 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.13),transparent_42%),linear-gradient(180deg,rgba(4,13,25,0.5),rgba(1,4,12,0.94))] shadow-[0_-28px_90px_rgba(8,47,73,0.22)]" />
        <div className="pointer-events-none absolute bottom-[11dvh] left-[7vw] z-30 h-px w-[24vw] rotate-[-13deg] bg-gradient-to-r from-transparent via-cyan-100/24 to-transparent" />
        <div className="pointer-events-none absolute bottom-[11dvh] right-[7vw] z-30 h-px w-[24vw] rotate-[13deg] bg-gradient-to-l from-transparent via-cyan-100/24 to-transparent" />

        <div className="pointer-events-none absolute left-1/2 top-[5.2%] z-20 w-[min(58rem,90vw)] -translate-x-1/2 text-center sm:top-[8%]">
          <div className="flex items-center justify-center gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-100/18 to-cyan-100/34" />
            <span className="relative inline-flex items-center gap-2 rounded-full border border-cyan-200/18 bg-slate-950/34 px-4 py-1.5 text-[10px] tracking-[0.28em] text-cyan-50/78 shadow-[0_0_34px_rgba(34,211,238,0.08)] backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/72 shadow-[0_0_12px_rgba(125,211,252,0.72)]" />
              <span>驾驶舱导航</span>
            </span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-100/18 to-cyan-100/34" />
          </div>
          <p className="mt-2 text-[10px] tracking-[0.32em] text-slate-400/70 sm:text-xs">
            模拟巡航 · 知识屏同步中
          </p>
          <div className="mx-auto mt-3 h-px w-[min(18rem,52vw)] bg-gradient-to-r from-transparent via-cyan-100/18 to-transparent" />
          {topicSyncError ? (
            <p className="mt-3 text-xs tracking-normal text-amber-200/80">
              {topicSyncError}
            </p>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2 sm:right-5 sm:top-5">
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-300/38 hover:bg-cyan-400/16 hover:text-white"
            >
              新增卡片
            </button>
            <button
              type="button"
              onClick={() => {
                const firstSection = liveTopic.sections[0];
                if (firstSection) {
                  openEditEditor(firstSection);
                }
              }}
              className="inline-flex rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              编辑卡片
            </button>
          </div>
        ) : null}

        <div
          className={[
            "transition-opacity duration-300",
            openSection ? "pointer-events-none opacity-18" : "opacity-100",
          ].join(" ")}
        >
          <TopicDetailNodeLayer
            anchors={visibleAnchors}
            sectionsById={sectionsById}
            openSectionId={openSectionId}
            hoveredSectionId={hoveredSectionId}
            viewport={viewport}
            onHoverSection={setHoveredSectionId}
            onOpenSection={openParameterScreen}
          />
        </div>

        {openSection ? (
          <div className="pointer-events-auto absolute inset-x-[3.5vw] top-[8.8dvh] z-[65] h-[72dvh] sm:inset-x-[5vw] sm:top-[10.5dvh] sm:h-[68dvh]">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${openSection.id}-dialog-title`}
              className={[
                "expanded-cockpit-main-screen relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.8rem] border bg-[linear-gradient(180deg,rgba(5,19,35,0.94),rgba(1,7,18,0.97))] p-4 shadow-[0_0_120px_rgba(34,211,238,0.13)] backdrop-blur-2xl sm:rounded-[2.4rem] sm:p-6",
                accent.dialogBorder,
              ].join(" ")}
              initial={{ opacity: 0, scale: 0.84, y: 34, filter: "brightness(1.5)" }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: "brightness(1)" }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.065),transparent_24%),repeating-linear-gradient(180deg,rgba(125,211,252,0.052)_0_1px,transparent_1px_7px),radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.1),transparent_44%)]" />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/50 to-transparent" />
              <div className="pointer-events-none absolute -left-20 top-1/3 h-44 w-44 rounded-full bg-cyan-300/8 blur-3xl" />
              <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/8 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.2em] text-cyan-100/62">
                    <span>主屏展开</span>
                    <span className="h-px w-8 bg-cyan-100/24" />
                    <span className="inline-flex items-center gap-1.5">
                      <Signal className="h-3 w-3" />
                      <span>已被查看 {openSection.viewCount ?? 0} 次</span>
                    </span>
                  </div>
                  <h3
                    id={`${openSection.id}-dialog-title`}
                    className="mt-3 text-2xl font-light tracking-[0.08em] text-white sm:text-4xl"
                  >
                    {openSection.title}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300/84 sm:text-base">
                    {openSection.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSectionId(null)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-cyan-200/28 hover:bg-cyan-300/10 hover:text-white"
                  aria-label="关闭主屏"
                >
                  ×
                </button>
              </div>

              <div className="relative z-10 mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden sm:mt-4 sm:gap-4 lg:grid-cols-[1fr_16rem]">
                <div className="min-h-0 overflow-y-auto pr-1 [mask-image:linear-gradient(to_bottom,black,black_calc(100%_-_18px),transparent)]">
                  <div className="space-y-4">
                    {openSection.body.map((paragraph, paragraphIndex) => (
                      <p
                        key={`${openSection.id}-${paragraphIndex}`}
                        className={[
                          "border-l-2 py-1 pl-4 text-sm leading-7 text-slate-200/88 sm:text-[15px]",
                          accent.dialogBorder,
                        ].join(" ")}
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                <aside className="hidden min-h-0 border-l border-white/8 pl-4 lg:block">
                  <p className="text-[10px] tracking-[0.2em] text-slate-500">
                    可能关联的参数卡片
                  </p>
                  <div className="mt-4 space-y-2">
                    {relatedSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => openParameterScreen(section.id)}
                        className="group block w-full rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:border-cyan-200/24 hover:bg-cyan-300/8"
                      >
                        <span className="block text-xs text-slate-200 transition-colors group-hover:text-white">
                          {section.title}
                        </span>
                        <span className="mt-1.5 line-clamp-2 block text-[11px] leading-5 text-slate-500 transition-colors group-hover:text-cyan-100/62">
                          {section.summary}
                        </span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] tracking-[0.14em] text-cyan-100/42 transition-colors group-hover:text-cyan-100/70">
                          <span className="h-px w-5 bg-current/50" />
                          打开关联卡片
                        </span>
                      </button>
                    ))}
                  </div>
                  {openSection.sourceUrl ? (
                    <a
                      href={openSection.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white"
                    >
                      查看来源
                    </a>
                  ) : null}
                </aside>
              </div>
            </motion.div>
          </div>
        ) : null}

        <div className="absolute inset-x-3 bottom-3 z-40 mx-auto max-w-5xl sm:inset-x-4 sm:bottom-7">
          <div className="relative overflow-hidden rounded-[1.45rem] border border-cyan-100/12 bg-[linear-gradient(180deg,rgba(5,20,36,0.72),rgba(1,6,16,0.9))] px-3.5 py-3 shadow-[0_0_80px_rgba(14,165,233,0.12)] backdrop-blur-xl sm:rounded-[1.75rem] sm:px-5 sm:py-4">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.08),transparent)]" />
            <div className="relative z-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] tracking-[0.28em] text-cyan-100/58">
                  驾驶舱中控台
                </p>
                <h2
                  className={[
                    "mt-1.5 bg-gradient-to-r bg-clip-text text-xl font-light tracking-[0.14em] text-transparent sm:text-3xl",
                    accent.title,
                  ].join(" ")}
                >
                  当前航线：{liveTopic.title}
                </h2>
                <p className={`mt-2 line-clamp-1 text-xs leading-relaxed sm:text-sm ${accent.summary}`}>
                  {liveTopic.summary}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.16em] text-slate-300/78">
                <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
                  {liveTopic.sections.length} 项参数配置
                </span>
                {canPageScreens ? (
                  <span className="rounded-full border border-white/8 bg-white/6 px-3 py-1">
                    第 {screenGroupIndex}/{screenGroupTotal} 组
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={showPreviousScreenGroup}
                  disabled={!canPageScreens || visibleScreenStart === 0}
                  className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200/14 bg-cyan-300/8 px-3 py-1 text-cyan-100/82 transition-colors hover:border-cyan-200/32 hover:bg-cyan-300/14 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-3 w-3" />
                  <span>上一组</span>
                </button>
                <button
                  type="button"
                  onClick={showNextScreenGroup}
                  disabled={!canPageScreens}
                  className="pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-full border border-cyan-200/18 bg-cyan-300/10 px-3 py-1 text-cyan-100 transition-colors hover:border-cyan-200/38 hover:bg-cyan-300/16 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <span>下一组</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && editorState ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/78 px-4 py-8 backdrop-blur-md"
          onClick={closeEditor}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="knowledge-card-editor-title"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,36,0.98),rgba(4,9,20,0.96))] p-6 shadow-[0_0_90px_rgba(2,132,199,0.18)] sm:max-h-[74vh] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-mono tracking-[0.18em] text-cyan-200/85">
                  {editorState.mode === "create" ? "NEW CARD" : "EDIT CARD"}
                </span>
                <h3
                  id="knowledge-card-editor-title"
                  className="mt-4 text-2xl font-medium text-white"
                >
                  {editorState.mode === "create" ? "新增卡片" : "编辑卡片"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                aria-label="关闭编辑弹窗"
              >
                ×
              </button>
            </div>

            <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">标题</span>
                <input
                  value={editorState.title}
                  onChange={(event) => updateEditorField("title", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">摘要</span>
                <input
                  value={editorState.summary}
                  onChange={(event) => updateEditorField("summary", event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">正文</span>
                <textarea
                  value={editorState.bodyText}
                  onChange={(event) => updateEditorField("bodyText", event.target.value)}
                  rows={8}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-7 text-white outline-none transition-colors focus:border-cyan-300/50"
                />
                <span className="mt-2 block text-xs text-slate-500">
                  用空行分隔段落
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">来源链接</span>
                <input
                  value={editorState.sourceUrl}
                  onChange={(event) =>
                    updateEditorField("sourceUrl", event.target.value)
                  }
                  placeholder="https://example.com/source"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">
                  标签（逗号分隔）
                </span>
                <input
                  value={editorState.tagsText}
                  onChange={(event) =>
                    updateEditorField("tagsText", event.target.value)
                  }
                  placeholder="科普, 入门, 静音"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-300/50"
                />
              </label>

              {editorState.mode === "edit" ? (
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">
                    优先展示
                  </span>
                  <label className="flex items-center gap-3 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={editorState.isFeatured}
                      disabled={!isAdmin}
                      onChange={(event) =>
                        updateEditorField("isFeatured", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-white/20 bg-slate-950/70 text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span>设为重点卡片</span>
                  </label>
                  {!isAdmin ? (
                    <span className="mt-2 block text-xs text-slate-500">
                      仅管理员可设置
                    </span>
                  ) : null}
                </label>
              ) : null}

              {editorState.error ? (
                <p className="text-sm text-rose-300">{editorState.error}</p>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300 transition-colors hover:border-white/20 hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void saveEditor()}
                disabled={editorState.isSubmitting}
                className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-4 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-300/38 hover:bg-cyan-400/18 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editorState.isSubmitting ? "保存中..." : "保存卡片"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </>
  );
}
