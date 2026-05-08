import crypto from "node:crypto";
import type { Pool } from "pg";

import {
  KNOWLEDGE_NEBULA_TOPICS,
  type KnowledgeNebulaSection,
  type KnowledgeNebulaTopic,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.js";

export type KnowledgeNebulaCardInput = {
  title: string;
  summary: string;
  body: string[];
  isFeatured: boolean;
  sourceUrl?: string | null;
  tags?: string[];
};

export type KnowledgeEmbeddingService = {
  embedKnowledgeCard: (
    input: Pick<KnowledgeNebulaCardInput, "title" | "summary" | "body" | "tags">,
  ) => Promise<number[] | null>;
};

export type KnowledgeNebulaStore = {
  getTopicBySlug: (
    slug: string,
  ) => Promise<KnowledgeNebulaTopic | null>;
  createCard: (
    topicSlug: string,
    input: KnowledgeNebulaCardInput,
  ) => Promise<KnowledgeNebulaTopic | null>;
  updateCard: (
    cardId: string,
    input: KnowledgeNebulaCardInput,
  ) => Promise<KnowledgeNebulaTopic | null>;
  recordCardView: (
    cardId: string,
    viewerKey: string,
  ) => Promise<{ cardId: string; viewCount: number; counted: boolean } | null>;
};

type TopicRow = {
  slug: string;
  title: string;
  short_label: string;
  summary: string;
  accent: KnowledgeNebulaTopic["accent"];
};

type CardRow = {
  id: string;
  topic_slug: string;
  title: string;
  summary: string;
  body: unknown;
  is_featured: boolean;
  source_url: string | null;
  tags: unknown;
  sort_order: number;
  view_count: number;
  embedding: unknown;
};

type SeedStateRow = {
  seed_version: string;
};

export const KNOWLEDGE_NEBULA_SEED_VERSION = `knowledge-nebula-${crypto
  .createHash("sha256")
  .update(JSON.stringify(KNOWLEDGE_NEBULA_TOPICS))
  .digest("hex")
  .slice(0, 12)}`;

export async function ensureKnowledgeNebulaSchema(
  pool: Pick<Pool, "query">,
) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.knowledge_nebula_topics (
      slug text PRIMARY KEY,
      title text NOT NULL,
      short_label text NOT NULL,
      summary text NOT NULL,
      accent text NOT NULL CHECK (accent IN ('cyan', 'sky', 'indigo')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.knowledge_nebula_cards (
      id text PRIMARY KEY,
      topic_slug text NOT NULL REFERENCES public.knowledge_nebula_topics(slug) ON DELETE CASCADE,
      title text NOT NULL,
      summary text NOT NULL,
      body jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_featured boolean NOT NULL DEFAULT false,
      source_url text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      embedding jsonb,
      view_count integer NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE public.knowledge_nebula_cards
    ADD COLUMN IF NOT EXISTS source_url text
  `);

  await pool.query(`
    ALTER TABLE public.knowledge_nebula_cards
    ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  await pool.query(`
    ALTER TABLE public.knowledge_nebula_cards
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE public.knowledge_nebula_cards
    ADD COLUMN IF NOT EXISTS embedding jsonb
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.knowledge_nebula_card_views (
      card_id text NOT NULL REFERENCES public.knowledge_nebula_cards(id) ON DELETE CASCADE,
      viewer_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (card_id, viewer_key)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_nebula_cards_topic_sort
    ON public.knowledge_nebula_cards(topic_slug, sort_order, created_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_nebula_card_views_card_created
    ON public.knowledge_nebula_card_views(card_id, created_at)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.knowledge_nebula_seed_state (
      seed_key text PRIMARY KEY,
      seed_version text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const seedStateResult = await pool.query<SeedStateRow>(
    `
      SELECT seed_version
      FROM public.knowledge_nebula_seed_state
      WHERE seed_key = 'default'
      LIMIT 1
    `,
  );

  if (seedStateResult.rows[0]?.seed_version === KNOWLEDGE_NEBULA_SEED_VERSION) {
    return;
  }

  for (const topic of KNOWLEDGE_NEBULA_TOPICS) {
    await pool.query(
      `
        INSERT INTO public.knowledge_nebula_topics (
          slug,
          title,
          short_label,
          summary,
          accent
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (slug) DO UPDATE
        SET
          title = EXCLUDED.title,
          short_label = EXCLUDED.short_label,
          summary = EXCLUDED.summary,
          accent = EXCLUDED.accent
      `,
      [topic.slug, topic.title, topic.shortLabel, topic.summary, topic.accent],
    );

    for (const [index, section] of topic.sections.entries()) {
      await pool.query(
        `
          INSERT INTO public.knowledge_nebula_cards (
            id,
            topic_slug,
            title,
            summary,
            body,
            is_featured,
            source_url,
            tags,
            embedding,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, $10)
          ON CONFLICT (id) DO UPDATE
          SET embedding = COALESCE(
            public.knowledge_nebula_cards.embedding,
            EXCLUDED.embedding
          )
        `,
        [
          section.id,
          topic.slug,
          section.title,
          section.summary,
          JSON.stringify(section.body),
          topic.featuredSectionIds.includes(section.id),
          section.sourceUrl ?? null,
          JSON.stringify(section.tags ?? []),
          section.embedding ? JSON.stringify(section.embedding) : null,
          index,
        ],
      );
    }
  }

  await pool.query(
    `
      INSERT INTO public.knowledge_nebula_seed_state (seed_key, seed_version)
      VALUES ('default', $1)
      ON CONFLICT (seed_key) DO UPDATE
      SET
        seed_version = EXCLUDED.seed_version,
        updated_at = now()
    `,
    [KNOWLEDGE_NEBULA_SEED_VERSION],
  );
}

export function createKnowledgeNebulaStore({
  pool,
  embeddingService,
}: {
  pool: Pick<Pool, "query">;
  embeddingService?: KnowledgeEmbeddingService;
}): KnowledgeNebulaStore {
  const topicCache = new Map<string, KnowledgeNebulaTopic>();

  async function readFreshTopicBySlug(slug: string) {
    const topicRow = await readTopicRow(pool, slug);
    if (!topicRow) {
      topicCache.delete(slug);
      return null;
    }

    const cardRows = await readCardRows(pool, slug);
    const topic = mapTopicRows(topicRow, cardRows);
    topicCache.set(slug, topic);
    return topic;
  }

  return {
    async getTopicBySlug(slug) {
      const cachedTopic = topicCache.get(slug);
      if (cachedTopic) {
        return cachedTopic;
      }

      return readFreshTopicBySlug(slug);
    },

    async createCard(topicSlug, input) {
      const topicRow = await readTopicRow(pool, topicSlug);
      if (!topicRow) {
        return null;
      }

      const nextSortOrder = await readNextSortOrder(pool, topicSlug);
      const embedding = await embeddingService?.embedKnowledgeCard(input);

      await pool.query(
        `
          INSERT INTO public.knowledge_nebula_cards (
            id,
            topic_slug,
            title,
            summary,
            body,
            is_featured,
            source_url,
            tags,
            embedding,
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, $10)
        `,
        [
          `custom-${crypto.randomUUID()}`,
          topicSlug,
          input.title,
          input.summary,
          JSON.stringify(input.body),
          input.isFeatured,
          input.sourceUrl?.trim() || null,
          JSON.stringify(input.tags ?? []),
          embedding ? JSON.stringify(embedding) : null,
          nextSortOrder,
        ],
      );

      topicCache.delete(topicSlug);
      return readFreshTopicBySlug(topicSlug);
    },

    async updateCard(cardId, input) {
      const embedding = await embeddingService?.embedKnowledgeCard(input);
      const result = await pool.query<{ topic_slug: string }>(
        `
          UPDATE public.knowledge_nebula_cards
          SET
            title = $2,
            summary = $3,
            body = $4::jsonb,
            is_featured = $5,
            source_url = $6,
            tags = $7::jsonb,
            embedding = COALESCE($8::jsonb, embedding),
            updated_at = now()
          WHERE id = $1
          RETURNING topic_slug
        `,
        [
          cardId,
          input.title,
          input.summary,
          JSON.stringify(input.body),
          input.isFeatured,
          input.sourceUrl?.trim() || null,
          JSON.stringify(input.tags ?? []),
          embedding ? JSON.stringify(embedding) : null,
        ],
      );

      const topicSlug = result.rows[0]?.topic_slug;
      if (!topicSlug) {
        return null;
      }

      topicCache.delete(topicSlug);
      return readFreshTopicBySlug(topicSlug);
    },

    async recordCardView(cardId, viewerKey) {
      const existingCard = await pool.query<{
        id: string;
        topic_slug: string;
        view_count: number;
      }>(
        `
          SELECT id, topic_slug, view_count
          FROM public.knowledge_nebula_cards
          WHERE id = $1
          LIMIT 1
        `,
        [cardId],
      );

      const cardRow = existingCard.rows[0];
      if (!cardRow) {
        return null;
      }

      const insertedView = await pool.query<{ card_id: string }>(
        `
          INSERT INTO public.knowledge_nebula_card_views (card_id, viewer_key)
          VALUES ($1, $2)
          ON CONFLICT (card_id, viewer_key) DO NOTHING
          RETURNING card_id
        `,
        [cardId, viewerKey],
      );
      const counted = insertedView.rowCount > 0;

      if (!counted) {
        return {
          cardId: cardRow.id,
          viewCount: cardRow.view_count,
          counted: false,
        };
      }

      const result = await pool.query<{ id: string; view_count: number }>(
        `
          UPDATE public.knowledge_nebula_cards
          SET
            view_count = view_count + 1,
            updated_at = now()
          WHERE id = $1
          RETURNING id, view_count
        `,
        [cardId],
      );
      const row = result.rows[0] ?? cardRow;
      topicCache.delete(cardRow.topic_slug);

      return {
        cardId: row.id,
        viewCount: row.view_count,
        counted: true,
      };
    },
  };
}

async function readTopicRow(
  pool: Pick<Pool, "query">,
  slug: string,
) {
  const result = await pool.query<TopicRow>(
    `
      SELECT slug, title, short_label, summary, accent
      FROM public.knowledge_nebula_topics
      WHERE slug = $1
      LIMIT 1
    `,
    [slug],
  );

  return result.rows[0];
}

async function readCardRows(
  pool: Pick<Pool, "query">,
  topicSlug: string,
) {
  const result = await pool.query<CardRow>(
    `
      SELECT id, topic_slug, title, summary, body, is_featured, source_url, tags, sort_order
      , view_count, embedding
      FROM public.knowledge_nebula_cards
      WHERE topic_slug = $1
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `,
    [topicSlug],
  );

  return result.rows;
}

async function readNextSortOrder(
  pool: Pick<Pool, "query">,
  topicSlug: string,
) {
  const result = await pool.query<{ next_sort_order: number }>(
    `
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
      FROM public.knowledge_nebula_cards
      WHERE topic_slug = $1
    `,
    [topicSlug],
  );

  return result.rows[0]?.next_sort_order ?? 0;
}

function mapTopicRows(
  topicRow: TopicRow,
  cardRows: CardRow[],
): KnowledgeNebulaTopic {
  const relatedIdsByCardId = buildRelatedSectionIds(cardRows);
  const sections: KnowledgeNebulaSection[] = cardRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: normalizeBody(row.body),
    relatedSectionIds: relatedIdsByCardId.get(row.id) ?? [],
    sourceUrl: row.source_url,
    tags: normalizeTags(row.tags),
    viewCount: row.view_count,
  }));

  return {
    slug: topicRow.slug as KnowledgeNebulaTopicSlug,
    title: topicRow.title,
    shortLabel: topicRow.short_label,
    summary: topicRow.summary,
    accent: topicRow.accent,
    featuredSectionIds: cardRows
      .filter((row) => row.is_featured)
      .map((row) => row.id),
    sections,
  };
}

function normalizeBody(body: unknown) {
  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((paragraph) => String(paragraph).trim())
    .filter(Boolean);
}

function normalizeTags(tags: unknown) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.map((tag) => String(tag).trim()).filter(Boolean);
}

function buildRelatedSectionIds(cardRows: CardRow[]) {
  const relationMap = new Map<string, string[]>();
  const featuredIds = new Set(
    cardRows.filter((row) => row.is_featured).map((row) => row.id),
  );

  for (const row of cardRows) {
    const currentEmbedding = normalizeEmbedding(row.embedding);
    const currentTags = normalizeTags(row.tags);
    const scoredRows = cardRows
      .filter((candidate) => candidate.id !== row.id)
      .map((candidate) => {
        const candidateEmbedding = normalizeEmbedding(candidate.embedding);
        const semanticScore =
          currentEmbedding && candidateEmbedding
            ? cosineSimilarity(currentEmbedding, candidateEmbedding) * 100
            : 0;
        const tagScore =
          countOverlap(currentTags, normalizeTags(candidate.tags)) * 8;
        const featuredScore = featuredIds.has(candidate.id) ? 2 : 0;
        const heatScore = Math.min(candidate.view_count ?? 0, 20) / 20;

        return {
          id: candidate.id,
          score: semanticScore + tagScore + featuredScore + heatScore,
          sortOrder: candidate.sort_order,
        };
      })
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.sortOrder - right.sortOrder;
      })
      .slice(0, 3)
      .map((candidate) => candidate.id);

    relationMap.set(row.id, scoredRows);
  }

  return relationMap;
}

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const embedding = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

  return embedding.length > 0 ? embedding : null;
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function countOverlap(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item)).length;
}
