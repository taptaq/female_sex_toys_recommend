import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import {
  createKnowledgeNebulaStore,
  ensureKnowledgeNebulaSchema,
  KNOWLEDGE_NEBULA_SEED_VERSION,
} from "./knowledge-nebula-store.ts";

type QueryCall = {
  sql: string;
  values?: unknown[];
};

function createKnowledgePool() {
  const calls: QueryCall[] = [];

  return {
    calls,
    pool: {
      async query(sql: string, values?: unknown[]) {
        calls.push({ sql, values });

        if (sql.includes("FROM public.knowledge_nebula_topics")) {
          return {
            rows: [
              {
                slug: "science",
                title: "正经科普",
                short_label: "正经科普",
                summary: "先补齐基础认知",
                accent: "cyan",
              },
            ],
          };
        }

        if (sql.includes("FROM public.knowledge_nebula_cards")) {
          return {
            rows: [
              {
                id: "current",
                title: "当前卡片",
                summary: "当前摘要",
                body: ["当前正文"],
                is_featured: true,
                source_url: null,
                tags: ["预算", "新手"],
                sort_order: 0,
                view_count: 1,
                embedding: [1, 0, 0],
              },
              {
                id: "semantic-close",
                title: "语义最接近",
                summary: "接近摘要",
                body: ["接近正文"],
                is_featured: false,
                source_url: null,
                tags: ["清洁"],
                sort_order: 1,
                view_count: 0,
                embedding: [0.96, 0.04, 0],
              },
              {
                id: "tag-close",
                title: "标签接近",
                summary: "标签摘要",
                body: ["标签正文"],
                is_featured: false,
                source_url: null,
                tags: ["预算"],
                sort_order: 2,
                view_count: 9,
                embedding: [0, 1, 0],
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
  };
}

test("knowledge nebula store ranks related cards by embedding similarity first", async () => {
  const { pool } = createKnowledgePool();
  const store = createKnowledgeNebulaStore({ pool: pool as unknown as Pick<Pool, "query"> });

  const topic = await store.getTopicBySlug("science");
  const current = topic?.sections.find((section) => section.id === "current");

  assert.deepEqual(current?.relatedSectionIds, [
    "semantic-close",
    "tag-close",
  ]);
});

test("knowledge nebula store reuses the cached topic payload for repeated slug reads", async () => {
  const { pool, calls } = createKnowledgePool();
  const store = createKnowledgeNebulaStore({ pool: pool as unknown as Pick<Pool, "query"> });

  const first = await store.getTopicBySlug("science");
  const second = await store.getTopicBySlug("science");

  assert.deepEqual(second, first);
  const topicReads = calls.filter((call) =>
    call.sql.includes("FROM public.knowledge_nebula_topics"),
  );
  const cardReads = calls.filter((call) =>
    call.sql.includes("FROM public.knowledge_nebula_cards"),
  );

  assert.equal(topicReads.length, 1);
  assert.equal(cardReads.length, 1);
});

test("knowledge nebula card rows read embedding data for semantic matching", async () => {
  const { pool, calls } = createKnowledgePool();
  const store = createKnowledgeNebulaStore({ pool: pool as unknown as Pick<Pool, "query"> });

  await store.getTopicBySlug("science");

  assert.ok(
    calls.some((call) => /embedding/.test(call.sql)),
    "card query should select embedding",
  );
});

test("knowledge nebula schema seeds default cards with deterministic embeddings", async () => {
  const calls: QueryCall[] = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };

  await ensureKnowledgeNebulaSchema(pool as unknown as Pick<Pool, "query">);

  const defaultCardInsert = calls.find((call) =>
    call.sql.includes("INSERT INTO public.knowledge_nebula_cards"),
  );

  assert.ok(defaultCardInsert, "default cards should be seeded");
  assert.match(defaultCardInsert.sql, /embedding/);
  assert.ok(
    typeof defaultCardInsert.values?.[8] === "string",
    "seed embedding should be serialized into the insert values",
  );
  assert.ok(
    Array.isArray(JSON.parse(defaultCardInsert.values[8] as string)),
    "seed embedding value should be a JSON array",
  );
});

test("knowledge nebula schema refreshes seeded topic display names", async () => {
  const calls: QueryCall[] = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };

  await ensureKnowledgeNebulaSchema(pool as unknown as Pick<Pool, "query">);

  const topicInsert = calls.find((call) =>
    call.sql.includes("INSERT INTO public.knowledge_nebula_topics"),
  );

  assert.ok(topicInsert, "default topics should be seeded");
  assert.match(topicInsert.sql, /ON CONFLICT \(slug\) DO UPDATE/);
  assert.deepEqual(topicInsert.values?.slice(0, 4), [
    "science",
    "参数与体验原理",
    "参数原理",
    "理解参数、结构和体感之间的关系，避免被营销词带偏。",
  ]);
});

test("knowledge nebula schema skips reseeding when the seeded content version is already current", async () => {
  const calls: QueryCall[] = [];
  const pool = {
    async query(sql: string, values?: unknown[]) {
      calls.push({ sql, values });

      if (sql.includes("FROM public.knowledge_nebula_seed_state")) {
        return {
          rows: [{ seed_version: KNOWLEDGE_NEBULA_SEED_VERSION }],
        };
      }

      return { rows: [] };
    },
  };

  await ensureKnowledgeNebulaSchema(pool as unknown as Pick<Pool, "query">);

  assert.equal(
    calls.some((call) => call.sql.includes("INSERT INTO public.knowledge_nebula_topics")),
    false,
  );
  assert.equal(
    calls.some((call) => call.sql.includes("INSERT INTO public.knowledge_nebula_cards")),
    false,
  );
});
