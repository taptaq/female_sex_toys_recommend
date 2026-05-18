import type { Request, Response } from "express";

type UsernameRegistrationService = {
  createUsernameUser: (
    username: string,
    password: string,
  ) => Promise<{ success: true; userId: string }>;
};

type UserProfileStore = {
  upsertProfile: (input: { userId: string; username: string }) => Promise<void>;
};

export function createUsernameRegistrationHandler({
  service,
  profileStore,
}: {
  service: UsernameRegistrationService;
  profileStore?: UserProfileStore;
}) {
  return async (req: Request, res: Response) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password.trim()) {
      res.status(400).json({
        error: "Username and password are required",
      });
      return;
    }

    const result = await service.createUsernameUser(username, password);
    if (profileStore) {
      await profileStore.upsertProfile({
        userId: result.userId,
        username,
      });
    }
    res.status(201).json({ success: true });
  };
}
