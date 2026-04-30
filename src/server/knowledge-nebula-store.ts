import crypto from "node:crypto";
import type { Pool } from "pg";

import {
  KNOWLEDGE_NEBULA_TOPICS,
  type KnowledgeNebulaSection,
  type KnowledgeNebulaTopic,
  type KnowledgeNebulaTopicSlug,
} from "../data/knowledge-nebula.ts";

export type KnowledgeNebulaCardInput = {
  title: string;
  summary: string;
  body: string[];
  isFeatured: boolean;
  sourceUrl?: string | null;
  tags?: string[];
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
  title: string;
  summary: string;
  body: unknown;
  is_featured: boolean;
  source_url: string | null;
  tags: unknown;
  sort_order: number;
};

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
    CREATE INDEX IF NOT EXISTS idx_knowledge_nebula_cards_topic_sort
    ON public.knowledge_nebula_cards(topic_slug, sort_order, created_at)
  `);

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
        ON CONFLICT (slug) DO NOTHING
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
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)
          ON CONFLICT (id) DO NOTHING
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
          index,
        ],
      );
    }
  }
}

export function createKnowledgeNebulaStore({
  pool,
}: {
  pool: Pick<Pool, "query">;
}): KnowledgeNebulaStore {
  return {
    async getTopicBySlug(slug) {
      const topicRow = await readTopicRow(pool, slug);
      if (!topicRow) {
        return null;
      }

      const cardRows = await readCardRows(pool, slug);
      return mapTopicRows(topicRow, cardRows);
    },

    async createCard(topicSlug, input) {
      const topicRow = await readTopicRow(pool, topicSlug);
      if (!topicRow) {
        return null;
      }

      const nextSortOrder = await readNextSortOrder(pool, topicSlug);

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
            sort_order
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)
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
          nextSortOrder,
        ],
      );

      return this.getTopicBySlug(topicSlug);
    },

    async updateCard(cardId, input) {
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
        ],
      );

      const topicSlug = result.rows[0]?.topic_slug;
      if (!topicSlug) {
        return null;
      }

      return this.getTopicBySlug(topicSlug);
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
      SELECT id, title, summary, body, is_featured, source_url, tags, sort_order
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
  const sections: KnowledgeNebulaSection[] = cardRows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    body: normalizeBody(row.body),
    sourceUrl: row.source_url,
    tags: normalizeTags(row.tags),
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
