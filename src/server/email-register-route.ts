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

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (email.length > MAX_EMAIL_LENGTH || !BASIC_EMAIL_PATTERN.test(email)) {
      res.status(400).json({
        error: "A valid email address is required",
      });
      return;
    }

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      res.status(400).json({
        error: "Password must be between 8 and 128 characters",
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
