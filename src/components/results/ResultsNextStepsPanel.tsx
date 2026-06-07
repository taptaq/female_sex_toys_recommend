import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

import { buildResultNextStepGroups } from "../../lib/recommendation-results.ts";

type ResultsNextStepGroup = ReturnType<typeof buildResultNextStepGroups>[number];

export function ResultsNextStepsPanel({
  nextStepGroups,
}: {
  nextStepGroups: ResultsNextStepGroup[];
}) {
  if (nextStepGroups.length === 0) {
    return null;
  }

  return (
    <motion.div
      id="result-next-steps"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5"
    >
      <div className="mb-2 flex items-center gap-2 text-amber-400">
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium tracking-wide">购买前再确认这几件事</span>
      </div>
      <div className="space-y-4">
        {nextStepGroups.map((group) => (
          <div
            key={group.id}
            className="rounded-2xl border border-amber-100 bg-white/72 p-3"
          >
            <h3 className="mb-2 text-sm font-black text-amber-700">
              {group.title}
            </h3>
            <ul className="space-y-2">
              {group.items.map((tip, index) => (
                <li
                  key={`${group.id}-${index}`}
                  className="flex items-start gap-2 text-sm font-semibold leading-6 text-slate-600"
                >
                  <span className="mt-1 shrink-0 text-amber-300">•</span>
                  <span className="break-words">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
