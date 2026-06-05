import type { Request, Response } from "express";

type EmailRegistrationService = {
  createEmailUser: (
    email: string,
    password: string,
  ) => Promise<{ success: true; userId: string }>;
};

type UserProfileStore = {
  upsertProfile: (input: { userId: string; username: string }) => Promise<void>;
};

export function createEmailRegistrationHandler({
  service,
  profileStore,
}: {
  service: EmailRegistrationService;
  profileStore?: UserProfileStore;
}) {
  return async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password.trim()) {
      res.status(400).json({
        error: "Email and password are required",
      });
      return;
    }

    const result = await service.createEmailUser(email, password);
    if (profileStore) {
      await profileStore.upsertProfile({
        userId: result.userId,
        username: email,
      });
    }
    res.status(201).json({ success: true });
  };
}
