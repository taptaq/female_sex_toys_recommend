import { motion } from "motion/react";
import { useState } from "react";
import {
  Orbit,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  Boxes,
  LogOut,
  Sparkles,
} from "lucide-react";
import { AuthPanel, type AuthPanelMode } from "../components/AuthPanel.tsx";
import { usePagePerformanceState } from "../lib/page-performance.ts";

function SecondaryEntryButton({
  children,
  tooltip,
  tone,
  onClick,
}: {
  children: string;
  tooltip: string;
  tone: "indigo" | "cyan";
  onClick: () => void;
}) {
  const Icon = tone === "cyan" ? Sparkles : Boxes;
  const toneClass =
    tone === "cyan"
      ? "hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
      : "hover:border-indigo-300/30 hover:bg-indigo-400/10 hover:text-indigo-100";

  return (
    <span className="home-secondary-node group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${children}：${tooltip}`}
        className={[
          "relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/8 bg-white/[0.035] px-4 py-2 text-xs tracking-wider text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 group-hover:-translate-y-0.5",
          toneClass,
        ].join(" ")}
      >
        <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/8 to-transparent transition-transform duration-500 group-hover:translate-x-[120%]" />
        <Icon className="relative h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
        <span className="relative">{children}</span>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 w-[13.5rem] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-3 py-2 text-center text-[11px] leading-5 text-slate-300 opacity-0 shadow-[0_0_34px_rgba(14,165,233,0.14)] backdrop-blur-xl transition-all duration-150 group-focus-within:-translate-y-1 group-focus-within:opacity-100 group-hover:-translate-y-1 group-hover:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}

function HomeAuthEntry({
  authPanel,
  onOpenProfiles,
}: {
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  onOpenProfiles: () => void;
}) {
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);

  if (authPanel.userLabel) {
    return (
      <div className="home-auth-entry mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300/12 bg-emerald-400/[0.045] px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-50">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-200/75" />
            已登录，推荐档案可同步
          </p>
          <p className="mt-1 truncate text-[11px] text-emerald-100/55">
            {authPanel.userLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenProfiles}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200/16 bg-cyan-100/8 px-3 py-1.5 text-xs text-cyan-50 transition-colors hover:bg-cyan-100/14"
          >
            我的装备匹配档案
          </button>
          <button
            type="button"
            onClick={() => void authPanel.onSignOut()}
            disabled={authPanel.isSubmitting}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200/16 bg-emerald-100/8 px-3 py-1.5 text-xs text-emerald-50 transition-colors hover:bg-emerald-100/14 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="home-auth-entry mt-5 flex w-full flex-col gap-3 rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.035] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-cyan-50">
            <KeyRound className="h-3.5 w-3.5 text-cyan-200/70" />
            完成匹配后可加密保存
          </p>
          <p className="mt-1 text-[11px] leading-5 text-cyan-100/48">
            登录后可加密保存推荐档案，支持多端同步，也可随时删除。不影响先体验匹配流程。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAuthPanelOpen(true)}
          className="shrink-0 rounded-full border border-cyan-300/18 bg-cyan-300/9 px-4 py-2 text-xs tracking-wider text-cyan-50 transition-colors hover:border-cyan-200/34 hover:bg-cyan-300/14"
        >
          登录 / 注册
        </button>
      </div>

      {isAuthPanelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-xl"
          onClick={() => setIsAuthPanelOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <AuthPanel {...authPanel} surface="modal" />
            <button
              type="button"
              onClick={() => setIsAuthPanelOpen(false)}
              className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              暂时不用
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function HomePage({
  pageVariants,
  onStart,
  onBrowseLibrary,
  onOpenKnowledgeNebula,
  onOpenProfiles,
  authPanel,
}: {
  pageVariants: any;
  onStart: () => void;
  onBrowseLibrary: () => void;
  onOpenKnowledgeNebula: () => void;
  onOpenProfiles: () => void;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
}) {
  const { repeat, shouldAnimate } = usePagePerformanceState();

  return (
    <motion.div
      key="welcome"
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className={[
        "relative w-full flex flex-col items-center px-1 py-2",
        shouldAnimate ? "" : "ambient-motion-paused",
      ].join(" ")}
    >
      <div className="home-space-depth pointer-events-none absolute left-1/2 top-[-16%] -z-10 h-[120%] w-[100vw] -translate-x-1/2 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_28%_68%,rgba(99,102,241,0.08),transparent_32%)]" />
        <div className="home-space-stars home-space-stars-a absolute inset-0" />
        <div className="home-space-stars home-space-stars-b absolute inset-0" />
        <div className="home-space-orbit absolute left-1/2 top-[16%] h-[38rem] w-[72rem] -translate-x-1/2 rounded-[50%] border border-cyan-100/8" />
        <div className="home-space-orbit home-space-orbit-offset absolute left-1/2 top-[21%] h-[32rem] w-[58rem] -translate-x-1/2 rounded-[50%] border border-indigo-100/7" />
        <div className="home-space-comet absolute left-[72%] top-[18%] h-px w-32 rotate-[-18deg]" />
      </div>

      <div className="relative mb-12 flex justify-center items-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: shouldAnimate ? 20 : 0.2, repeat, ease: "linear" }}
          className="absolute w-32 h-32 border border-cyan-500/20 rounded-full"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: shouldAnimate ? 30 : 0.2, repeat, ease: "linear" }}
          className="absolute w-40 h-40 border border-indigo-500/20 rounded-full border-dashed"
        />
        <motion.span
          className="absolute h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(125,211,252,0.85)]"
          animate={{ rotate: 360 }}
          transition={{ duration: shouldAnimate ? 7 : 0.2, repeat, ease: "linear" }}
          style={{ transformOrigin: "4.25rem 0.25rem" }}
        />
        <div className="home-orbit-core w-20 h-20 glass-panel rounded-full flex items-center justify-center relative z-10 overflow-hidden shadow-[0_0_48px_rgba(34,211,238,0.16)]">
          <div className="absolute inset-2 rounded-full bg-cyan-300/6 blur-md" />
          <Orbit className="relative w-10 h-10 text-cyan-300 opacity-90" />
        </div>
      </div>

      <div className="glass-panel relative rounded-3xl p-8 w-full text-center overflow-hidden flex flex-col items-center shadow-[0_24px_90px_rgba(2,8,23,0.42)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(115deg,transparent,rgba(255,255,255,0.035),transparent_42%)]" />
        <div className="home-panel-scan pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-transparent via-cyan-100/8 to-transparent" />

        <h1 className="relative text-3xl font-light tracking-widest mb-2 text-white">
          内太空装备智能选品向导
        </h1>
        <h2 className="relative text-xs tracking-widest text-cyan-500/80 mb-8 font-mono">
          SELECTION GUIDE
        </h2>

        <p className="relative text-sm text-slate-300 mb-10 leading-relaxed max-w-[300px]">
          跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于严密的过滤体系，为你精准匹配出最契合自身需求的私密设备。
        </p>

        <button
          onClick={onStart}
          className="home-primary-ignition group relative w-full py-4 rounded-2xl bg-cyan-500/18 hover:bg-cyan-400/24 border border-cyan-300/40 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2 shadow-[0_0_36px_rgba(34,211,238,0.16)]"
        >
          <motion.div
            className="absolute inset-0 bg-cyan-400/5"
            animate={{ scale: [1, 1.2, 1], opacity: [0, 0.8, 0] }}
            transition={{ duration: shouldAnimate ? 2.5 : 0.2, repeat }}
          />
          <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-[340%]" />
          <span className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent opacity-70" />
          <span className="relative z-10 flex items-center gap-2 tracking-widest text-sm font-medium">
            开始匹配
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <div className="mt-5 flex w-full flex-col items-center gap-2 border-t border-white/8 pt-5 sm:flex-row sm:justify-center sm:gap-4">
          <SecondaryEntryButton
            onClick={onBrowseLibrary}
            tone="indigo"
            tooltip="先看真实装备参数、价格区间和筛选维度，建立大概参考。"
          >
            先随便看看装备库
          </SecondaryEntryButton>

          <SecondaryEntryButton
            onClick={onOpenKnowledgeNebula}
            tone="cyan"
            tooltip="了解常见误区、参数怎么读，以及新手选择时该避开的坑。"
          >
            看看知识星云
          </SecondaryEntryButton>
        </div>

        <HomeAuthEntry authPanel={authPanel} onOpenProfiles={onOpenProfiles} />
      </div>
    </motion.div>
  );
}
