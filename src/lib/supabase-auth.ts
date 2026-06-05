import { createClient, type Session } from "@supabase/supabase-js";

type SupabaseAuthEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

type SupabaseAuthClient = ReturnType<typeof createClient>;

let cachedClient: SupabaseAuthClient | null = null;

function readRuntimeEnv(): SupabaseAuthEnv {
  return ((import.meta as ImportMeta & { env?: SupabaseAuthEnv }).env ?? {}) as SupabaseAuthEnv;
}

export function getSupabaseAuthConfig(env: SupabaseAuthEnv = readRuntimeEnv()) {
  return {
    url: (env.VITE_SUPABASE_URL ?? "").trim(),
    anonKey: (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim(),
  };
}

export function isSupabaseAuthConfigured(env: SupabaseAuthEnv = readRuntimeEnv()) {
  const config = getSupabaseAuthConfig(env);
  return Boolean(config.url && config.anonKey);
}

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getSupabaseAuthConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

export function getReadableSupabaseAuthErrorMessage(
  mode: "signup" | "signin",
  message: string,
) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage.includes("email not confirmed")) {
    return "这个邮箱账号还未完成确认。请先检查邮箱确认邮件，或在 Supabase Auth > Users 中确认该账号状态。";
  }

  if (normalizedMessage.includes("user already registered")) {
    return mode === "signup"
      ? "这个邮箱已注册，请直接登录或换一个邮箱。"
      : "这个邮箱已经存在，但当前密码不匹配。";
  }

  if (
    normalizedMessage.includes("email rate limit exceeded") ||
    normalizedMessage.includes("over_email_send_rate_limit")
  ) {
    return "注册邮件触发过于频繁，Supabase 暂时限流了。请稍后再试，或换一个邮箱。";
  }

  return message;
}

export async function registerEmailPassword({
  email,
  password,
  fetcher = fetch,
}: {
  email: string;
  password: string;
  fetcher?: typeof fetch;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password.trim()) {
    throw new Error("请先填写邮箱和密码。");
  }

  const response = await fetcher("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password,
    }),
  });

  const result = (await response.json().catch(() => null)) as
    | { success?: boolean; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      getReadableSupabaseAuthErrorMessage(
        "signup",
        result?.error || "注册失败，请稍后重试",
      ),
    );
  }

  return { success: true };
}

export async function signInWithEmailPassword(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase 登录配置缺失，请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) {
    throw new Error(
      getReadableSupabaseAuthErrorMessage(
        "signin",
        error.message || "登录失败，请检查邮箱和密码",
      ),
    );
  }
  return data;
}

export async function signOutOfSupabase() {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message || "退出登录失败，请稍后重试");
  }
}

export async function getCurrentSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) {
    return null;
  }
  return data.session;
}

export function onSupabaseAuthStateChange(
  listener: (session: Session | null) => void,
) {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    listener(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
