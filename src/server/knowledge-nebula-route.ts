import type { Request, Response } from "express";

import type {
  KnowledgeNebulaCardInput,
  KnowledgeNebulaStore,
} from "./knowledge-nebula-store.ts";

export function createKnowledgeNebulaTopicHandler({
  store,
}: {
  store: Pick<KnowledgeNebulaStore, "getTopicBySlug">;
}) {
  return async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }

    try {
      const topic = await store.getTopicBySlug(slug);
      if (!topic) {
        res.status(404).json({ error: "Knowledge topic not found" });
        return;
      }

      res.json(topic);
    } catch (error) {
      console.error("❌ [Server/Knowledge] 读取知识主题失败:", error);
      res
        .status(500)
        .json({ error: "Knowledge topic fetch failed", details: String(error) });
    }
  };
}

export function createKnowledgeNebulaCreateCardHandler({
  store,
}: {
  store: Pick<KnowledgeNebulaStore, "createCard">;
}) {
  return async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      res.status(400).json({ error: "slug is required" });
      return;
    }

    const input = parseKnowledgeNebulaCardInput(req.body);
    if (!input) {
      res.status(400).json({ error: "title, summary, and bodyText are required" });
      return;
    }

    try {
      const topic = await store.createCard(slug, input);
      if (!topic) {
        res.status(404).json({ error: "Knowledge topic not found" });
        return;
      }

      res.status(201).json(topic);
    } catch (error) {
      console.error("❌ [Server/Knowledge] 创建知识卡片失败:", error);
      res
        .status(500)
        .json({ error: "Knowledge card create failed", details: String(error) });
    }
  };
}

export function createKnowledgeNebulaUpdateCardHandler({
  store,
}: {
  store: Pick<KnowledgeNebulaStore, "updateCard">;
}) {
  return async (req: Request, res: Response) => {
    const cardId = String(req.params.cardId || "").trim();
    if (!cardId) {
      res.status(400).json({ error: "cardId is required" });
      return;
    }

    const input = parseKnowledgeNebulaCardInput(req.body);
    if (!input) {
      res.status(400).json({ error: "title, summary, and bodyText are required" });
      return;
    }

    try {
      const topic = await store.updateCard(cardId, input);
      if (!topic) {
        res.status(404).json({ error: "Knowledge card not found" });
        return;
      }

      res.json(topic);
    } catch (error) {
      console.error("❌ [Server/Knowledge] 更新知识卡片失败:", error);
      res
        .status(500)
        .json({ error: "Knowledge card update failed", details: String(error) });
    }
  };
}

export function parseKnowledgeNebulaCardInput(
  body: unknown,
): KnowledgeNebulaCardInput | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const title = String((body as Record<string, unknown>).title || "").trim();
  const summary = String((body as Record<string, unknown>).summary || "").trim();
  const bodyText = String((body as Record<string, unknown>).bodyText || "").trim();

  if (!title || !summary || !bodyText) {
    return null;
  }

  const parsedBody = bodyText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (parsedBody.length === 0) {
    return null;
  }

  const sourceUrlValue = String(
    (body as Record<string, unknown>).sourceUrl || "",
  ).trim();
  const tagsValue = (body as Record<string, unknown>).tags;
  const normalizedTags = String(tagsValue || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const input: KnowledgeNebulaCardInput = {
    title,
    summary,
    body: parsedBody,
    isFeatured: Boolean((body as Record<string, unknown>).isFeatured),
    sourceUrl: sourceUrlValue || null,
    tags: normalizedTags,
  };

  return input;
}
