import type { Request, Response } from "express";

import {
  resolveBearerUserId,
  type AccessTokenVerifier,
} from "./user-auth.js";
import type { UserFavoritesStore } from "./user-favorites-store.js";

function readAuthorizationHeader(headers: Request["headers"]) {
  return Array.isArray(headers.authorization)
    ? headers.authorization[0]
    : headers.authorization;
}

function normalizeProductId(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function resolveAuthenticatedUserId(input: {
  req: Request;
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
}) {
  return await resolveBearerUserId({
    authorizationHeader: readAuthorizationHeader(input.req.headers),
    jwtSecret: input.jwtSecret,
    authVerifier: input.authVerifier,
  });
}

export function createAddFavoriteHandler({
  jwtSecret,
  authVerifier,
  store,
}: {
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserFavoritesStore, "addFavorite">;
}) {
  return async (req: Request, res: Response) => {
    const userId = await resolveAuthenticatedUserId({
      req,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({ error: "Login is required to favorite products" });
      return;
    }

    const productId = normalizeProductId((req.body ?? {})["productId"]);
    if (!productId) {
      res.status(400).json({ error: "productId is required" });
      return;
    }

    try {
      await store.addFavorite(userId, productId);
      res.status(201).json({ ok: true });
    } catch (error) {
      console.error("❌ [Server/Favorites] 收藏失败:", error);
      res.status(500).json({
        error: "Favorite save failed",
        details: getErrorMessage(error),
      });
    }
  };
}

export function createListFavoritesHandler({
  jwtSecret,
  authVerifier,
  store,
}: {
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserFavoritesStore, "listFavorites">;
}) {
  return async (req: Request, res: Response) => {
    const userId = await resolveAuthenticatedUserId({
      req,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({ error: "Login is required to view favorites" });
      return;
    }

    try {
      const productIds = await store.listFavorites(userId);
      res.json({ productIds });
    } catch (error) {
      console.error("❌ [Server/Favorites] 读取收藏失败:", error);
      res.status(500).json({
        error: "Favorite list failed",
        details: getErrorMessage(error),
      });
    }
  };
}

export function createDeleteFavoriteHandler({
  jwtSecret,
  authVerifier,
  store,
}: {
  jwtSecret: string | undefined;
  authVerifier?: AccessTokenVerifier;
  store: Pick<UserFavoritesStore, "deleteFavorite">;
}) {
  return async (req: Request, res: Response) => {
    const userId = await resolveAuthenticatedUserId({
      req,
      jwtSecret,
      authVerifier,
    });

    if (!userId) {
      res.status(401).json({ error: "Login is required to remove favorites" });
      return;
    }

    const productId = normalizeProductId(req.params.productId);
    if (!productId) {
      res.status(400).json({ error: "productId is required" });
      return;
    }

    try {
      await store.deleteFavorite(userId, productId);
      res.json({ ok: true });
    } catch (error) {
      console.error("❌ [Server/Favorites] 取消收藏失败:", error);
      res.status(500).json({
        error: "Favorite delete failed",
        details: getErrorMessage(error),
      });
    }
  };
}
