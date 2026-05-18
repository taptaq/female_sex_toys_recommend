import { createClient } from "@supabase/supabase-js";

import { buildInternalAuthEmailFromUsername } from "../lib/supabase-auth.js";

export function createUsernameRegistrationService({
  supabaseUrl,
  serviceRoleKey,
}: {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
}) {
  return {
    async createUsernameUser(username: string, password: string) {
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase service role configuration is missing");
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const email = buildInternalAuthEmailFromUsername(username);
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
        },
        app_metadata: {
          display_name: username,
        },
      });

      if (error) {
        throw new Error(error.message || "注册失败，请稍后重试");
      }

      const userId = data.user?.id;
      if (!userId) {
        throw new Error("注册成功但未返回用户 ID");
      }

      return { success: true, userId } as const;
    },
  };
}
