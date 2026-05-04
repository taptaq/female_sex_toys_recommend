import { ChevronDown } from "lucide-react";

export function ResultParameterGuide({
  isOpen,
  onToggle,
  onOpenTopic,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onOpenTopic: (
    topic: "science" | "people" | "care",
    sectionId?: string,
  ) => void;
}) {
  const quickLinks = [
    { label: "看静音与场景", topic: "people" as const, sectionId: "science-noise" },
    { label: "看清洁与护理", topic: "care" as const, sectionId: "care-waterproof" },
    { label: "看参数原理", topic: "science" as const, sectionId: "science-body" },
  ];

  return (
    <div className="w-full rounded-2xl border border-cyan-400/14 bg-cyan-400/[0.05] px-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-[11px] font-medium text-cyan-100/82">
          了解参数怎么看
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-cyan-200/70 transition-transform",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          />
        </button>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-cyan-300/10 pt-3">
          {quickLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => onOpenTopic(link.topic, link.sectionId)}
              className="inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/78 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
            >
              {link.label}
            </button>
          ))}
        </div>

      {isOpen ? (
        <div className="mt-3 space-y-3 border-t border-cyan-300/10 pt-3 text-[11px] leading-5 text-slate-300">
          <div>
            <p className="text-cyan-100/82">噪音怎么看</p>
            <p className="mt-1">dB 越低，越适合同住、深夜或更低打扰的场景。</p>
            <button
              type="button"
              onClick={() => onOpenTopic("people", "science-noise")}
              className="mt-2 inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/78 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
            >
              看静音与场景
            </button>
          </div>
          <div>
            <p className="text-cyan-100/82">防水怎么看</p>
            <p className="mt-1">防水等级越清晰，后续清洁和收尾通常越省心。</p>
            <button
              type="button"
              onClick={() => onOpenTopic("care", "care-waterproof")}
              className="mt-2 inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/78 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
            >
              看清洁与护理
            </button>
          </div>
          <div>
            <p className="text-cyan-100/82">电机怎么看</p>
            <p className="mt-1">温柔电机更适合慢热和新手，强力电机更看重直接反馈。</p>
            <button
              type="button"
              onClick={() => onOpenTopic("science", "science-body")}
              className="mt-2 inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/8 px-2.5 py-1 text-[11px] text-cyan-100/78 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
            >
              看参数原理
            </button>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onOpenTopic("science", "science-body")}
              className="inline-flex items-center rounded-full border border-cyan-400/18 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-100/82 transition-colors hover:border-cyan-300/32 hover:bg-cyan-300/14"
            >
              去知识星云继续看
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
