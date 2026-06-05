import assert from "node:assert/strict";
import test from "node:test";

import {
  getSupabaseAuthConfig,
  getReadableSupabaseAuthErrorMessage,
  isSupabaseAuthConfigured,
  registerEmailPassword,
} from "./supabase-auth.ts";

test("isSupabaseAuthConfigured requires both url and anon key", () => {
  assert.equal(
    isSupabaseAuthConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key",
    }),
    true,
  );

  assert.equal(
    isSupabaseAuthConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co",
    }),
    false,
  );
});

test("getSupabaseAuthConfig trims configured values", () => {
  assert.deepEqual(
    getSupabaseAuthConfig({
      VITE_SUPABASE_URL: " https://example.supabase.co ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " anon-key ",
    }),
    {
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    },
  );
});

test("getReadableSupabaseAuthErrorMessage explains unconfirmed email accounts in Chinese", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signin", "Email not confirmed"),
    "这个邮箱账号还未完成确认。请先检查邮箱确认邮件，或在 Supabase Auth > Users 中确认该账号状态。",
  );
});

test("getReadableSupabaseAuthErrorMessage maps duplicate users to email conflict wording", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signup", "User already registered"),
    "这个邮箱已注册，请直接登录或换一个邮箱。",
  );
});

test("getReadableSupabaseAuthErrorMessage explains email send rate limits in Chinese", () => {
  assert.equal(
    getReadableSupabaseAuthErrorMessage("signup", "email rate limit exceeded"),
    "注册邮件触发过于频繁，Supabase 暂时限流了。请稍后再试，或换一个邮箱。",
  );
});

test("registerEmailPassword calls the server-side registration endpoint", async () => {
  let captured: unknown;

  const result = await registerEmailPassword({
    email: " Taptaq@example.COM ",
    password: "secret-pass",
    fetcher: async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        json: async () => ({ success: true }),
      } as Response;
    },
  });

  assert.deepEqual(result, { success: true });
  assert.match(JSON.stringify(captured), /\/api\/auth\/register/);
  assert.match(JSON.stringify(captured), /taptaq@example\.com/);
});
