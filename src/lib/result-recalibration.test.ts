import test from "node:test";
import assert from "node:assert/strict";
import type {
  BackupCandidate,
  RecommendationAnswers,
  RecommendationRankedProduct,
} from "./recommendation-results.ts";
import {
  buildResultRecalibrationPayload,
  clearResultSourceState,
  normalizeRecalibratedBackupProducts,
  readResultSourceState,
  resolveCurrentResultSourceState,
} from "./result-recalibration.ts";

function createRankedProduct(
  overrides: Partial<RecommendationRankedProduct> & Pick<RecommendationRankedProduct, "id" | "name" | "score" | "price">,
): RecommendationRankedProduct {
  return {
    id: overrides.id,
    name: overrides.name,
    score: overrides.score,
    price: overrides.price,
    maxDb: 42,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    brand: "Test Brand",
    material: "Silicone",
    imagePlaceholder: "image",
    tags: ["静音"],
    matchSummary: ["静音表现稳定"],
    hardMisses: 0,
    budgetGap: 0,
    noiseGap: 0,
    link: null,
    sourceUrl: null,
    ...overrides,
  };
}

function createBackupCandidate(
  overrides: Partial<BackupCandidate> & Pick<BackupCandidate, "id" | "name" | "score" | "price" | "backupLabel" | "backupReason">,
): BackupCandidate {
  return {
    ...createRankedProduct(overrides),
    backupLabel: overrides.backupLabel,
    backupReason: overrides.backupReason,
    ...overrides,
  };
}

test("readResultSourceState prefers a valid persisted provider", () => {
  assert.deepEqual(
    readResultSourceState({
      currentResultProvider: "qwen",
      currentResultModelName: "qwen-max",
    }),
    {
      currentResultProvider: "qwen",
      currentResultModelName: "qwen-max",
      currentSelectedResultProvider: "qwen",
    },
  );
});

test("readResultSourceState keeps result source empty for invalid persisted values while preserving a safe selected provider", () => {
  assert.deepEqual(
    readResultSourceState({
      currentResultProvider: "not-a-provider",
      currentResultModelName: "mystery-model",
    }),
    {
      currentResultProvider: undefined,
      currentResultModelName: undefined,
      currentSelectedResultProvider: "dmxapi-mimo",
    },
  );
});

test("clearResultSourceState removes stale result metadata and preserves a safe selected provider", () => {
  assert.deepEqual(clearResultSourceState("glm"), {
    currentResultProvider: undefined,
    currentResultModelName: undefined,
    currentSelectedResultProvider: "glm",
  });

  assert.deepEqual(clearResultSourceState("not-a-provider"), {
    currentResultProvider: undefined,
    currentResultModelName: undefined,
    currentSelectedResultProvider: "dmxapi-mimo",
  });
});

test("resolveCurrentResultSourceState keeps current result empty when rerank falls back locally", () => {
  assert.deepEqual(
    resolveCurrentResultSourceState({
      selectedProvider: "glm",
    }),
    {
      currentResultProvider: undefined,
      currentResultModelName: undefined,
      currentSelectedResultProvider: "glm",
    },
  );
});

test("resolveCurrentResultSourceState uses the rerank source when one is available", () => {
  assert.deepEqual(
    resolveCurrentResultSourceState({
      selectedProvider: "glm",
      currentProvider: "qwen",
      currentModelName: "qwen-max",
    }),
    {
      currentResultProvider: "qwen",
      currentResultModelName: "qwen-max",
      currentSelectedResultProvider: "qwen",
    },
  );
});

test("readResultSourceState preserves empty result metadata after a clear-state persistence round trip", () => {
  const clearedState = clearResultSourceState("glm");

  assert.deepEqual(
    readResultSourceState({
      currentResultProvider: clearedState.currentResultProvider,
      currentResultModelName: clearedState.currentResultModelName,
    }),
    {
      currentResultProvider: undefined,
      currentResultModelName: undefined,
      currentSelectedResultProvider: "dmxapi-mimo",
    },
  );

  assert.deepEqual(readResultSourceState({}), {
    currentResultProvider: undefined,
    currentResultModelName: undefined,
    currentSelectedResultProvider: "dmxapi-mimo",
  });
});

test("buildResultRecalibrationPayload preserves the selected provider and ranking inputs", () => {
  const answers: RecommendationAnswers = {
    tags: ["静音", "高伪装"],
    gender: "female",
    physicalForm: "external",
    motorType: "gentle",
    maxDb: 45,
    waterproof: 7,
    budget: [100, 300],
    appearance: "high_disguise",
  };
  const rerankPool = [
    Object.assign(
      createRankedProduct({
        id: "p-1",
        name: "Top Pick",
        score: 95,
        price: 199,
      }),
      {
        rawDescription: "x".repeat(8192),
        personaAnalysis: "适合想兼顾静音和隐蔽的人群",
        isDomestic: true,
      },
    ),
  ];
  const rankedCandidates = [
    rerankPool[0],
    Object.assign(
      createRankedProduct({
        id: "b-1",
        name: "Backup Pick",
        score: 88,
        price: 149,
      }),
      {
        rawDescription: "y".repeat(8192),
        personaAnalysis: "适合作为更低预算的备选方向",
        isDomestic: false,
      },
    ),
  ];
  const recommendationTips = ["可以稍微放宽预算上限。"];

  const payload = buildResultRecalibrationPayload({
    answers,
    targetProvider: "glm",
    rerankPool,
    rankedCandidates,
    filteredCount: 6,
    recommendationTips,
  });

  assert.equal(payload.targetProvider, "glm");
  assert.equal(payload.recommendationTips, recommendationTips);
  assert.deepEqual(payload, {
    answers,
    targetProvider: "glm",
    rerankPool: [
      {
        id: "p-1",
        name: "Top Pick",
        score: 95,
        price: 199,
        maxDb: 42,
        waterproof: 7,
        appearance: "high_disguise",
        physicalForm: "external",
        motorType: "gentle",
        gender: "female",
        brand: "Test Brand",
        material: "Silicone",
        imagePlaceholder: "image",
        link: null,
        sourceUrl: null,
        tags: ["静音"],
        matchSummary: ["静音表现稳定"],
      },
    ],
    rankedCandidates: [
      {
        id: "p-1",
        name: "Top Pick",
        score: 95,
        price: 199,
        maxDb: 42,
        waterproof: 7,
        appearance: "high_disguise",
        physicalForm: "external",
        motorType: "gentle",
        gender: "female",
        brand: "Test Brand",
        material: "Silicone",
        imagePlaceholder: "image",
        link: null,
        sourceUrl: null,
        tags: ["静音"],
        matchSummary: ["静音表现稳定"],
      },
      {
        id: "b-1",
        name: "Backup Pick",
        score: 88,
        price: 149,
        maxDb: 42,
        waterproof: 7,
        appearance: "high_disguise",
        physicalForm: "external",
        motorType: "gentle",
        gender: "female",
        brand: "Test Brand",
        material: "Silicone",
        imagePlaceholder: "image",
        link: null,
        sourceUrl: null,
        tags: ["静音"],
        matchSummary: ["静音表现稳定"],
      },
    ],
    filteredCount: 6,
    recommendationTips,
  });
  assert.equal("rawDescription" in payload.rerankPool[0], false);
  assert.equal("personaAnalysis" in payload.rerankPool[0], false);
  assert.equal("isDomestic" in payload.rerankPool[0], false);
  assert.notEqual(payload.rerankPool[0], rerankPool[0]);
  assert.notEqual(payload.rankedCandidates[0], rankedCandidates[0]);
});

test("normalizeRecalibratedBackupProducts removes recalibrated top products from the backup section and preserves AI reasons where possible", () => {
  const rankedCandidates = [
    createRankedProduct({
      id: "p-1",
      name: "Top One",
      score: 99,
      price: 299,
      maxDb: 40,
      waterproof: 7,
    }),
    createRankedProduct({
      id: "p-2",
      name: "Top Two",
      score: 96,
      price: 269,
      maxDb: 41,
      waterproof: 6,
    }),
    createRankedProduct({
      id: "b-1",
      name: "Backup One",
      score: 92,
      price: 199,
      maxDb: 36,
      waterproof: 5,
      appearance: "normal",
    }),
    createRankedProduct({
      id: "b-2",
      name: "Backup Two",
      score: 90,
      price: 159,
      maxDb: 39,
      waterproof: 8,
      motorType: "strong",
    }),
    createRankedProduct({
      id: "b-3",
      name: "Backup Three",
      score: 88,
      price: 179,
      maxDb: 34,
      waterproof: 4,
    }),
  ];

  const normalized = normalizeRecalibratedBackupProducts({
    rankedCandidates,
    topProducts: [
      createRankedProduct({
        id: "p-1",
        name: "Top One",
        score: 99,
        price: 299,
      }),
      createRankedProduct({
        id: "b-1",
        name: "Backup One Promoted",
        score: 92,
        price: 199,
      }),
    ],
    backupProducts: [
      createBackupCandidate({
        id: "b-1",
        name: "Backup One Promoted",
        score: 92,
        price: 199,
        backupLabel: "更静音",
        backupReason: "这条理由应该被移除，因为它已进入 Top3",
      }),
      createBackupCandidate({
        id: "b-2",
        name: "Backup Two",
        score: 90,
        price: 159,
        backupLabel: "更省预算",
        backupReason: "AI 认为这条更适合控制预算",
      }),
    ],
    count: 3,
  });

  assert.deepEqual(
    normalized.map((product) => product.id),
    ["p-2", "b-2", "b-3"],
  );
  assert.equal(
    normalized.find((product) => product.id === "b-2")?.backupReason,
    "AI 认为这条更适合控制预算",
  );
  assert.equal(
    normalized.some((product) => product.id === "b-1"),
    false,
  );
});
