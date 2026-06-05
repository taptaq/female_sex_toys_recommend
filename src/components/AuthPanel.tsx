import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";

export type AuthPanelMode = "signin" | "signup";

type AuthPanelProps = {
  isConfigured: boolean;
  userLabel: string | null;
  statusMessage: string | null;
  isSubmitting: boolean;
  surface?: "embedded" | "modal";
  onSubmit: (mode: AuthPanelMode, email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function AuthPanel({
  isConfigured,
  userLabel,
  statusMessage,
  isSubmitting,
  surface = "embedded",
  onSubmit,
  onSignOut,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthPanelMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const panelClassName =
    surface === "modal"
      ? "auth-panel-modal w-full rounded-[1.7rem] border border-cyan-300/18 bg-slate-950 p-5 text-left shadow-[0_0_90px_rgba(8,47,73,0.38)] sm:p-6"
      : "mt-5 w-full rounded-2xl border border-cyan-300/14 bg-cyan-400/[0.045] p-4 text-left";
  const signedInPanelClassName =
    surface === "modal"
      ? "auth-panel-modal w-full rounded-[1.7rem] border border-emerald-300/18 bg-slate-950 p-5 text-left shadow-[0_0_90px_rgba(6,78,59,0.28)] sm:p-6"
      : "mt-5 w-full rounded-2xl border border-emerald-300/16 bg-emerald-400/[0.055] p-4 text-left";

  if (userLabel) {
    return (
      <div className={signedInPanelClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-50">
              <ShieldCheck className="h-4 w-4 text-emerald-200/80" />
              已登录，可加密保存并多端同步
            </p>
            <p className="mt-1 truncate text-xs text-emerald-100/60">{userLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={isSubmitting}
            className="inline-flex w-full shrink-0 justify-center gap-1 rounded-full border border-emerald-200/20 bg-emerald-100/8 px-3 py-1.5 text-xs text-emerald-50 transition-colors hover:bg-emerald-100/14 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:items-center"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
        {statusMessage && (
          <p className="mt-3 text-xs leading-5 text-emerald-100/70">{statusMessage}</p>
        )}
      </div>
    );
  }

  return (
    <form
      className={panelClassName}
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(mode, email, password);
      }}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-50">
            <KeyRound className="h-4 w-4 text-cyan-200/75" />
            登录后保存推荐档案
          </p>
          <p className="mt-1 text-xs leading-5 text-cyan-100/55">
            使用邮箱登录或注册
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"))}
          className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-200 transition-colors hover:bg-white/[0.07] sm:w-auto"
        >
          {mode === "signin" ? "去注册" : "去登录"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="邮箱"
          autoComplete="email"
          disabled={isSubmitting}
          className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          disabled={isSubmitting}
          className="rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-55"
        />
      </div>

      <button
        type="submit"
        disabled={!isConfigured || isSubmitting}
        className="mt-3 w-full rounded-xl border border-cyan-300/25 bg-cyan-300/12 px-3 py-2 text-xs font-medium tracking-wider text-cyan-50 transition-colors hover:border-cyan-200/45 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isSubmitting ? "处理中..." : mode === "signin" ? "登录" : "注册"}
      </button>

      {!isConfigured && (
        <p className="mt-3 text-xs leading-5 text-amber-100/75">
          需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY 后才能完成登录或注册。
        </p>
      )}
      {statusMessage && (
        <p className="mt-3 text-xs leading-5 text-cyan-100/65">{statusMessage}</p>
      )}
    </form>
  );
}
