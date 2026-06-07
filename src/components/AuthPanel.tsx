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
      ? "auth-panel-modal w-full rounded-[1.7rem] border border-sky-100 bg-white/95 p-5 text-left text-slate-900 shadow-[0_1.5rem_4rem_rgba(125,211,252,0.18)] sm:p-6"
      : "mt-5 w-full rounded-2xl border border-sky-100 bg-white/76 p-4 text-left text-slate-900";
  const signedInPanelClassName =
    surface === "modal"
      ? "auth-panel-modal w-full rounded-[1.7rem] border border-emerald-100 bg-white/95 p-5 text-left text-slate-900 shadow-[0_1.5rem_4rem_rgba(110,231,183,0.18)] sm:p-6"
      : "mt-5 w-full rounded-2xl border border-emerald-100 bg-white/76 p-4 text-left text-slate-900";

  if (userLabel) {
    return (
      <div className={signedInPanelClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-black text-emerald-700">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              已登录，可加密保存并多端同步
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{userLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            disabled={isSubmitting}
            className="inline-flex w-full shrink-0 justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:items-center"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
        {statusMessage && (
          <p className="mt-3 text-xs font-semibold leading-5 text-emerald-700">{statusMessage}</p>
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
          <p className="flex items-center gap-2 text-sm font-black text-sky-700">
            <KeyRound className="h-4 w-4 text-sky-500" />
            登录后保存推荐档案
          </p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            使用邮箱登录或注册
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMode((currentMode) => (currentMode === "signin" ? "signup" : "signin"))}
          className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-600 transition-colors hover:bg-sky-100 sm:w-auto"
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
          className="rounded-xl border border-sky-100 bg-white/86 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="密码"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          disabled={isSubmitting}
          className="rounded-xl border border-sky-100 bg-white/86 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-sky-300 disabled:cursor-not-allowed disabled:opacity-55"
        />
      </div>

      <button
        type="submit"
        disabled={!isConfigured || isSubmitting}
        className="mt-3 w-full rounded-xl border border-sky-200 bg-sky-500 px-3 py-2 text-xs font-black tracking-wider text-white shadow-[0_0.8rem_1.8rem_rgba(14,165,233,0.18)] transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {isSubmitting ? "处理中..." : mode === "signin" ? "登录" : "注册"}
      </button>

      {!isConfigured && (
        <p className="mt-3 text-xs font-semibold leading-5 text-amber-700">
          需要配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY 后才能完成登录或注册。
        </p>
      )}
      {statusMessage && (
        <p className="mt-3 text-xs font-semibold leading-5 text-sky-700">{statusMessage}</p>
      )}
    </form>
  );
}
