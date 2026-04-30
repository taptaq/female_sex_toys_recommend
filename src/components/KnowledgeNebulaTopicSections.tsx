import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type {
  KnowledgeNebulaSection,
  KnowledgeNebulaTopic,
} from "../data/knowledge-nebula.ts";

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
    badge: "border-cyan-400/18 bg-cyan-400/10 text-cyan-200/85",
    title: "text-cyan-50",
    summary: "text-cyan-100/72",
    border: "border-cyan-400/18",
    ring: "shadow-[0_0_34px_rgba(34,211,238,0.12)]",
    glow: "from-cyan-300/28 via-cyan-200/12 to-transparent",
    shard: "bg-[linear-gradient(165deg,rgba(11,33,54,0.94),rgba(4,12,28,0.9))]",
  },
  sky: {
    badge: "border-sky-400/18 bg-sky-400/10 text-sky-200/85",
    title: "text-sky-50",
    summary: "text-sky-100/72",
    border: "border-sky-400/18",
    ring: "shadow-[0_0_34px_rgba(56,189,248,0.12)]",
    glow: "from-sky-300/26 via-sky-200/12 to-transparent",
    shard: "bg-[linear-gradient(165deg,rgba(8,30,52,0.94),rgba(3,10,24,0.9))]",
  },
  indigo: {
    badge: "border-indigo-400/18 bg-indigo-400/10 text-indigo-200/85",
    title: "text-indigo-50",
    summary: "text-indigo-100/72",
    border: "border-indigo-400/18",
    ring: "shadow-[0_0_34px_rgba(129,140,248,0.12)]",
    glow: "from-indigo-300/28 via-indigo-200/12 to-transparent",
    shard: "bg-[linear-gradient(165deg,rgba(14,24,54,0.94),rgba(4,8,26,0.9))]",
  },
} as const;

function buildFragmentSections(topic: KnowledgeNebulaTopic) {
  const featuredIds = new Set(topic.featuredSectionIds);
  const featured = topic.sections.filter((section) => featuredIds.has(section.id));
  const rest = topic.sections.filter((section) => !featuredIds.has(section.id));
  return [...featured, ...rest];
}

function ShardButton({
  section,
  badgeLabel,
  accent,
  onOpen,
  onEdit,
  isAdmin,
}: {
  section: KnowledgeNebulaSection;
  badgeLabel: string;
  accent: (typeof ACCENT_STYLES)[KnowledgeNebulaTopic["accent"]];
  onOpen: (sectionId: string) => void;
  onEdit: (section: KnowledgeNebulaSection) => void;
  isAdmin: boolean;
}) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(section.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(section.id);
        }
      }}
      whileHover={{ y: -10, scale: 1.02 }}
      whileTap={{ scale: 0.985 }}
      className={[
        "group relative w-full cursor-pointer overflow-hidden rounded-[1.75rem] border px-5 py-5 text-left backdrop-blur-xl transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:px-6 sm:py-6",
        accent.border,
        accent.ring,
        accent.shard,
      ].join(" ")}
      aria-label={`展开 ${section.title}`}
    >
      <div
        className={[
          "pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r",
          accent.glow,
        ].join(" ")}
      />
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
        <div
          className={[
            "absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl",
            accent.glow,
          ].join(" ")}
        />
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(section);
          }}
          className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] tracking-[0.14em] text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
          aria-label={`编辑卡片 ${section.title}`}
        >
          编辑卡片
        </button>
      ) : null}
      <span
        className={[
          "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-mono tracking-[0.16em]",
          accent.badge,
        ].join(" ")}
      >
        {badgeLabel}
      </span>
      <h3 className={`mt-4 text-lg font-medium sm:text-xl ${accent.title}`}>
        {section.title}
      </h3>
      <p className={`mt-2 text-sm leading-relaxed ${accent.summary}`}>
        {section.summary}
      </p>
      <p className="mt-5 text-xs tracking-[0.14em] text-slate-400 transition-colors group-hover:text-slate-200">
        点击展开碎片
      </p>
    </motion.div>
  );
}

export function KnowledgeNebulaTopicSections({
  topic,
  isAdmin = false,
}: {
  topic: KnowledgeNebulaTopic;
  isAdmin?: boolean;
}) {
  const [liveTopic, setLiveTopic] = useState(topic);
  const [topicSyncError, setTopicSyncError] = useState<string | null>(null);
  const sectionsById = useMemo(
    () => new Map(liveTopic.sections.map((section) => [section.id, section])),
    [liveTopic.sections],
  );
  const fragmentSections = useMemo(() => buildFragmentSections(liveTopic), [liveTopic]);
  const featuredIds = useMemo(
    () => new Set(liveTopic.featuredSectionIds),
    [liveTopic.featuredSectionIds],
  );
  const hasInvalidFeaturedSectionIds =
    fragmentSections.filter((section) => featuredIds.has(section.id)).length !==
    liveTopic.featuredSectionIds.length;
  const accent = ACCENT_STYLES[liveTopic.accent];
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const openSection = openSectionId ? sectionsById.get(openSectionId) : undefined;
  const [editorState, setEditorState] = useState<KnowledgeCardEditorState | null>(
    null,
  );

  useEffect(() => {
    setLiveTopic(topic);
    setOpenSectionId(null);
    setEditorState(null);
    setTopicSyncError(null);
  }, [topic]);

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
          setLiveTopic(payload);
          setTopicSyncError(null);
        }
      } catch (error) {
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
    field: keyof Omit<KnowledgeCardEditorState, "mode" | "cardId" | "isSubmitting" | "error">,
    value: string | boolean,
  ) => {
    setEditorState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const closeEditor = () => {
    setEditorState(null);
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
      setLiveTopic(nextTopic);
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
      <div className="space-y-10">
        <section aria-labelledby={`${liveTopic.slug}-fragments`} className="space-y-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2
                id={`${liveTopic.slug}-fragments`}
                className="text-lg font-medium tracking-[0.16em] text-white"
              >
                内容碎片
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                所有内容统一放在这里，点击任意卡片展开查看
              </p>
              {topicSyncError ? (
                <p className="mt-2 text-xs text-amber-200/80">{topicSyncError}</p>
              ) : null}
              {hasInvalidFeaturedSectionIds ? (
                <p className="mt-2 text-xs text-amber-200/75">
                  当前主题有部分重点章节配置未命中，已跳过无效锚点。
                </p>
              ) : null}
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={openCreateEditor}
                className="inline-flex shrink-0 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition-colors hover:border-cyan-300/38 hover:bg-cyan-400/16 hover:text-white"
              >
                新增卡片
              </button>
            ) : null}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {fragmentSections.map((section, index) => {
              const isFeatured = featuredIds.has(section.id);

              return (
                <ShardButton
                  key={section.id}
                  section={section}
                  badgeLabel={
                    isFeatured
                      ? "重点"
                      : `SECTION ${String(index + 1).padStart(2, "0")}`
                  }
                  accent={accent}
                  onOpen={setOpenSectionId}
                  onEdit={openEditEditor}
                  isAdmin={isAdmin}
                />
              );
            })}
          </div>
        </section>
      </div>

      {openSection ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/76 px-4 py-8 backdrop-blur-md"
          onClick={() => setOpenSectionId(null)}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${openSection.id}-dialog-title`}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className={[
              "relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border p-6 shadow-[0_0_90px_rgba(2,132,199,0.18)] sm:p-7",
              accent.border,
              "bg-[linear-gradient(180deg,rgba(10,18,36,0.97),rgba(4,9,20,0.96))]",
            ].join(" ")}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={[
                "pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r",
                accent.glow,
              ].join(" ")}
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <span
                  className={[
                    "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-mono tracking-[0.18em]",
                    accent.badge,
                  ].join(" ")}
                >
                  SHARD OPEN
                </span>
                <h3
                  id={`${openSection.id}-dialog-title`}
                  className={`mt-4 text-2xl font-medium sm:text-3xl ${accent.title}`}
                >
                  {openSection.title}
                </h3>
                <p className={`mt-3 max-w-2xl text-sm leading-relaxed sm:text-base ${accent.summary}`}>
                  {openSection.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenSectionId(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                aria-label="关闭碎片弹窗"
              >
                ×
              </button>
            </div>

            <div className="mt-6 max-h-[52vh] space-y-4 overflow-y-auto pr-1">
              {openSection.body.map((paragraph, paragraphIndex) => (
                <p
                  key={`${openSection.id}-${paragraphIndex}`}
                  className="text-sm leading-7 text-slate-200/88 sm:text-[15px]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {openSection.tags?.length || openSection.sourceUrl ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/8 pt-5">
                {openSection.tags?.map((tag) => (
                  <span
                    key={`${openSection.id}-${tag}`}
                    className="rounded-full border border-cyan-300/14 bg-cyan-400/8 px-3 py-1 text-xs text-cyan-100/85"
                  >
                    {tag}
                  </span>
                ))}
                {openSection.sourceUrl ? (
                  <a
                    href={openSection.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 transition-colors hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-white"
                  >
                    查看来源
                  </a>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}

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
