import { motion } from "motion/react";
import { Orbit, ChevronRight, KeyRound, ShieldCheck, Trash2 } from "lucide-react";

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

        <p className="text-sm text-slate-300 mb-10 leading-relaxed max-w-[300px]">
          跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于严密的过滤体系，为你精准匹配出最契合自身需求的私密设备。
        </p>

        <button
          onClick={onStart}
          className="group relative w-full py-4 rounded-2xl bg-cyan-500/18 hover:bg-cyan-400/24 border border-cyan-300/40 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2 shadow-[0_0_36px_rgba(34,211,238,0.16)]"
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

        <div className="mt-5 flex w-full flex-col items-center gap-2 border-t border-white/8 pt-5 sm:flex-row sm:justify-center sm:gap-4">
          <button
            onClick={onBrowseLibrary}
            className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs tracking-wider text-slate-300 transition-colors hover:border-indigo-300/25 hover:bg-indigo-400/8 hover:text-indigo-100"
          >
            先随便看看装备库
          </button>

          <button
            onClick={onOpenKnowledgeNebula}
            className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs tracking-wider text-slate-300 transition-colors hover:border-cyan-300/25 hover:bg-cyan-400/8 hover:text-cyan-100"
          >
            看看知识星云
          </button>
        </div>

        <div className="mt-6 grid w-full grid-cols-1 gap-2 text-[10px] text-slate-500 font-mono tracking-wider sm:grid-cols-3">
          <span className="flex items-center justify-center gap-1.5 rounded-full border border-white/6 bg-white/[0.025] px-3 py-2">
            <KeyRound className="w-3.5 h-3.5 text-cyan-800" />
            登录后多端同步
          </span>
          <span className="flex items-center justify-center gap-1.5 rounded-full border border-white/6 bg-white/[0.025] px-3 py-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />
            敏感偏好加密保存
          </span>
          <span className="flex items-center justify-center gap-1.5 rounded-full border border-white/6 bg-white/[0.025] px-3 py-2">
            <Trash2 className="w-3.5 h-3.5 text-cyan-800" />
            可随时删除推荐记录
          </span>
        </div>
      </div>
    </motion.div>
  );
}
