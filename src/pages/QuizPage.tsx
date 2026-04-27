import { motion } from "motion/react";
import { ArrowLeft, CircleDashed, Hexagon, Triangle } from "lucide-react";
import { Question } from "../data/mock";

export function QuizPage({
  pageVariants,
  step,
  activeQuestions,
  onSelectOption,
  onBackHome,
}: {
  pageVariants: any;
  step: number;
  activeQuestions: Question[];
  onSelectOption: (value: any, tag: string) => void;
  onBackHome: () => void;
}) {
  const currentQuestion = activeQuestions[step];

  return (
    <motion.div
      key={`q-${step}`}
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full"
    >
      <div className="mb-4 px-2">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/15 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>返回首页</span>
        </button>
      </div>

      <div className="mb-8 flex justify-between items-center px-2">
        <span className="text-xs font-mono text-cyan-500/70 tracking-widest">
          PHASE 0{step + 1}
        </span>
        <div className="flex gap-1">
          {activeQuestions.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-500 ${index === step ? "w-6 bg-cyan-400" : index < step ? "w-2 bg-cyan-800" : "w-2 bg-white/10"}`}
            />
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <h2 className="text-xl font-medium text-white mb-2">
          {currentQuestion.title}
        </h2>
        <p className="text-sm text-slate-400 mb-8">
          {currentQuestion.subtitle}
        </p>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => onSelectOption(option.value, option.tag)}
              className="w-full text-left glass-button rounded-2xl p-5 flex items-center gap-4 group"
            >
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                {index === 0 ? (
                  <CircleDashed className="w-4 h-4 text-cyan-300" />
                ) : index === 1 ? (
                  <Hexagon className="w-4 h-4 text-indigo-300" />
                ) : (
                  <Triangle className="w-4 h-4 text-purple-300" />
                )}
              </div>
              <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
