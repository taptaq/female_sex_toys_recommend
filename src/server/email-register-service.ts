import { createClient } from "@supabase/supabase-js";

export function createEmailRegistrationService({
  supabaseUrl,
  serviceRoleKey,
}: {
  supabaseUrl: string | undefined;
  serviceRoleKey: string | undefined;
}) {
  return {
    async createEmailUser(email: string, password: string) {
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase service role configuration is missing");
      }

      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          email: normalizedEmail,
        },
        app_metadata: {
          display_name: normalizedEmail,
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
