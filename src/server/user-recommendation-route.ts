import type { Request, Response } from "express";

import {
  decryptPrivateJson,
  encryptPrivateJson,
  type EncryptedPrivateJson,
} from "./user-recommendation-privacy.js";
import type { UserRecommendationStore } from "./user-recommendation-store.js";
import {
  resolveBearerUserId,
  type AccessTokenVerifier,
} from "./user-auth.js";

function normalizeString(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSaveUserRecommendationProfileHandler({
  encryptionKey,
  jwtSecret,
  authVerifier,
  store,
}: {
  encryptionKey: string | undefined;
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserRecommendationStore, "saveEncryptedProfile">;
}) {
  return async (req: Request, res: Response) => {
    const authorizationHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const userId = await resolveBearerUserId({
      authorizationHeader,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({
        error: "Login is required to save encrypted recommendation profiles",
      });
      return;
    }

    if (!encryptionKey) {
      res.status(500).json({
        error: "Private data encryption key is not configured",
      });
      return;
    }

    try {
      const requestBody = (req.body ?? {}) as Record<string, unknown>;
      const encryptedPayload = encryptPrivateJson(requestBody, encryptionKey);
      const savedProfile = await store.saveEncryptedProfile(
        userId,
        encryptedPayload,
        {
          title: normalizeString(requestBody.title, "推荐档案"),
          summary: normalizeString(requestBody.summary, ""),
          topProductIds: normalizeStringArray(requestBody.topProductIds),
        },
      );

      res.status(201).json({ id: savedProfile.id });
    } catch (error) {
      console.error("❌ [Server/UserRecommendation] 保存推荐档案失败:", error);
      res.status(500).json({
        error: "Recommendation profile save failed",
        details: getErrorMessage(error),
      });
    }
  };
}

export function createListUserRecommendationProfilesHandler({
  encryptionKey,
  jwtSecret,
  authVerifier,
  store,
}: {
  encryptionKey: string | undefined;
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserRecommendationStore, "listEncryptedProfiles">;
}) {
  return async (req: Request, res: Response) => {
    const authorizationHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const userId = await resolveBearerUserId({
      authorizationHeader,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({
        error: "Login is required to view encrypted recommendation profiles",
      });
      return;
    }

    if (!encryptionKey) {
      res.status(500).json({
        error: "Private data encryption key is not configured",
      });
      return;
    }

    try {
      const rows = await store.listEncryptedProfiles(userId);
      const profiles = rows.flatMap((row) => {
        try {
          return [
            {
              id: row.id,
              title: row.title,
              summary: row.summary,
              topProductIds: row.topProductIds,
              savedAt: row.savedAt,
              payload: decryptPrivateJson(
                row.encryptedPayload as EncryptedPrivateJson,
                encryptionKey,
              ),
            },
          ];
        } catch (error) {
          console.warn(
            "⚠️ [Server/UserRecommendation] 跳过无法解密的推荐档案:",
            row.id,
            getErrorMessage(error),
          );
          return [];
        }
      });

      res.json({ profiles });
    } catch (error) {
      console.error("❌ [Server/UserRecommendation] 读取推荐档案失败:", error);
      res.status(500).json({
        error: "Recommendation profile list failed",
        details: getErrorMessage(error),
      });
    }
  };
}

export function createDeleteUserRecommendationProfileHandler({
  jwtSecret,
  authVerifier,
  store,
}: {
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserRecommendationStore, "deleteProfile">;
}) {
  return async (req: Request, res: Response) => {
    const authorizationHeader = Array.isArray(req.headers.authorization)
      ? req.headers.authorization[0]
      : req.headers.authorization;
    const userId = await resolveBearerUserId({
      authorizationHeader,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({
        error: "Login is required to delete recommendation profiles",
      });
      return;
    }

    const profileId = typeof req.params.profileId === "string"
      ? req.params.profileId.trim()
      : "";
    if (!profileId) {
      res.status(400).json({ error: "Missing recommendation profile id" });
      return;
    }

    try {
      await store.deleteProfile(userId, profileId);
      res.json({ ok: true });
    } catch (error) {
      console.error("❌ [Server/UserRecommendation] 删除推荐档案失败:", error);
      res.status(500).json({
        error: "Recommendation profile delete failed",
        details: getErrorMessage(error),
      });
    }
  };
}
