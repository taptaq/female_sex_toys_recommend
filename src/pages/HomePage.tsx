import { motion } from "motion/react";
import { Orbit, ChevronRight, ShieldCheck, Zap } from "lucide-react";

export function HomePage({
  pageVariants,
  onStart,
  onBrowseLibrary,
  onOpenKnowledgeNebula,
}: {
  pageVariants: any;
  onStart: () => void;
  onBrowseLibrary: () => void;
  onOpenKnowledgeNebula: () => void;
}) {
  return (
    <motion.div
      key="welcome"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="w-full flex flex-col items-center"
    >
      <div className="relative mb-12 flex justify-center items-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute w-32 h-32 border border-cyan-500/20 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute w-40 h-40 border border-indigo-500/20 rounded-full border-dashed"
        />
        <div className="w-20 h-20 glass-panel rounded-full flex items-center justify-center relative z-10">
          <Orbit className="w-10 h-10 text-cyan-300 opacity-90" />
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-8 w-full text-center relative overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>

        <h1 className="text-3xl font-light tracking-widest mb-2 text-white">
          内太空装备智能选品向导
        </h1>
        <h2 className="text-xs tracking-widest text-cyan-500/80 mb-8 font-mono">
          SELECTION GUIDE
        </h2>

        <p className="text-sm text-slate-300 mb-10 leading-relaxed max-w-[260px]">
          跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于严密的过滤体系，为你精准匹配出最契合自身需求的私密设备。
        </p>

        <button
          onClick={onStart}
          className="group relative w-full py-4 rounded-2xl bg-cyan-900/30 hover:bg-cyan-800/50 border border-cyan-500/30 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2"
        >
          <motion.div
            className="absolute inset-0 bg-cyan-400/5"
            animate={{ scale: [1, 1.2, 1], opacity: [0, 0.8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <span className="relative z-10 flex items-center gap-2 tracking-widest text-sm font-medium">
            开始匹配
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <button
          onClick={onBrowseLibrary}
          className="w-full py-4 mt-4 rounded-2xl bg-indigo-900/10 hover:bg-indigo-800/30 border border-indigo-500/20 text-indigo-200 transition-all text-sm tracking-widest flex items-center justify-center"
        >
          浏览全息装备库
        </button>

        <button
          onClick={onOpenKnowledgeNebula}
          className="w-full py-4 mt-4 rounded-2xl bg-slate-900/20 hover:bg-slate-800/40 border border-cyan-400/15 text-cyan-100 transition-all text-sm tracking-widest flex items-center justify-center"
        >
          进入知识星云
        </button>

        <div className="mt-6 flex justify-center items-center gap-6 text-[10px] text-slate-500 font-mono tracking-wider">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />
            绝对隐秘
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-800" />
            量化推荐
          </span>
        </div>
      </div>
    </motion.div>
  );
}
