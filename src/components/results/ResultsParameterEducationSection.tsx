import type { LucideIcon } from "lucide-react";
import { ResultParameterGuide } from "../ResultParameterGuide.tsx";

type KnowledgeTopicSlug = "science" | "people" | "care";

type ParameterPreviewItem = {
  id: string;
  title: string;
  preview: string;
  topicSlug: KnowledgeTopicSlug;
  sectionId?: string;
};

type MetricChip = {
  id: string;
  icon: LucideIcon;
  topicSlug: KnowledgeTopicSlug;
  sectionId?: string;
  label: string;
};

type ResultsParameterEducationSectionProps = {
  isGuideOpen: boolean;
  onToggleGuide: () => void;
  onOpenTopic: (topicSlug: KnowledgeTopicSlug, sectionId?: string) => void;
  previewItems: readonly ParameterPreviewItem[];
  metricChips: readonly MetricChip[];
};

export function ResultsParameterEducationSection({
  isGuideOpen,
  onToggleGuide,
  onOpenTopic,
  previewItems,
  metricChips,
}: ResultsParameterEducationSectionProps) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.028] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">继续了解参数</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            主推荐已经能先做决定；需要时再回来补参数原理和场景判断。
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenTopic("science", "science-body")}
          className="inline-flex shrink-0 items-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-1.5 text-[11px] text-cyan-100/82 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
        >
          去知识星云深读
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:items-start">
        <ResultParameterGuide
          isOpen={isGuideOpen}
          onToggle={onToggleGuide}
          onOpenTopic={onOpenTopic}
        />

        <div className="space-y-3">
          <div className="rounded-2xl border border-cyan-400/12 bg-cyan-400/[0.05] p-3">
            <p className="text-[11px] font-medium text-cyan-100/82">
              参数速览
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-400">
              先看一眼核心判断，再决定要不要进知识星云深读。
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {previewItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenTopic(item.topicSlug, item.sectionId)}
                  className="rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-3 text-left transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                >
                  <p className="text-[11px] font-medium text-cyan-100/84">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-300">
                    {item.preview}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {metricChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onOpenTopic(chip.topicSlug, chip.sectionId)}
                  className="flex max-w-full cursor-pointer items-start gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-cyan-300/24 hover:bg-cyan-300/[0.08]"
                  title="了解这个参数"
                >
                  <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="break-words">{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
