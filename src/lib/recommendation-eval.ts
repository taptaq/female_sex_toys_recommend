import assert from "node:assert/strict";

import type { AnswerState, Product } from "../data/mock.js";
import {
  buildLocalRecommendationRanking,
  type StructuredRankedProduct,
} from "./recommendation-local-ranking.js";
import type { RecommendationCandidatePoolContext } from "./recommendation-candidate-pool.js";

type TopProductExpectation = {
  id?: string;
  gender?: Product["gender"];
  typeCodes?: string[];
};

export type RecommendationEvalExpectations = {
  topCount?: number;
  top1?: TopProductExpectation;
  forbiddenGendersInTop?: Product["gender"][];
  forbiddenTypeCodesInTop?: string[];
  requiredTypeCodesInTop?: string[];
};

export type RecommendationEvalScenario = {
  id: string;
  answers: AnswerState;
  products: Product[];
  expectations: RecommendationEvalExpectations;
  context?: RecommendationCandidatePoolContext;
};

export type RecommendationEvalResult = {
  id: string;
  topProducts: StructuredRankedProduct[];
  rankedCandidates: StructuredRankedProduct[];
  failures: string[];
};

function formatProduct(product: Pick<Product, "id" | "name" | "gender" | "typeCode">) {
  return `${product.id}(${product.name}, ${product.gender}, ${product.typeCode ?? "null"})`;
}

function includesTypeCode(
  product: Pick<Product, "typeCode">,
  typeCodes: string[],
) {
  return product.typeCode != null && typeCodes.includes(product.typeCode);
}

export function runRecommendationEvalScenario(
  scenario: RecommendationEvalScenario,
): RecommendationEvalResult {
  const ranking = buildLocalRecommendationRanking(
    scenario.answers,
    scenario.products,
    {
      finalSelectionCount: scenario.expectations.topCount ?? 3,
      rerankPoolSize: Math.max(10, scenario.expectations.topCount ?? 3),
      context: scenario.context,
    },
  );
  const topProducts = ranking.fallbackTopProducts;
  const failures: string[] = [];
  const top1 = topProducts[0];

  if (!top1) {
    failures.push(`${scenario.id}: expected at least one top product`);
  }

  if (top1 && scenario.expectations.top1?.gender) {
    const expectedGender = scenario.expectations.top1.gender;
    if (top1.gender !== expectedGender) {
      failures.push(
        `${scenario.id}: top1 gender should be ${expectedGender}, got ${formatProduct(top1)}`,
      );
    }
  }

  if (top1 && scenario.expectations.top1?.id) {
    const expectedId = scenario.expectations.top1.id;
    if (top1.id !== expectedId) {
      failures.push(
        `${scenario.id}: top1 id should be ${expectedId}, got ${formatProduct(top1)}`,
      );
    }
  }

  if (top1 && scenario.expectations.top1?.typeCodes) {
    const expectedTypes = scenario.expectations.top1.typeCodes;
    if (!includesTypeCode(top1, expectedTypes)) {
      failures.push(
        `${scenario.id}: top1 type should be one of ${expectedTypes.join(", ")}, got ${formatProduct(top1)}`,
      );
    }
  }

  for (const forbiddenGender of scenario.expectations.forbiddenGendersInTop ?? []) {
    const matched = topProducts.filter((product) => product.gender === forbiddenGender);
    if (matched.length > 0) {
      failures.push(
        `${scenario.id}: top products should not include gender ${forbiddenGender}: ${matched.map(formatProduct).join(", ")}`,
      );
    }
  }

  for (const forbiddenType of scenario.expectations.forbiddenTypeCodesInTop ?? []) {
    const matched = topProducts.filter((product) => product.typeCode === forbiddenType);
    if (matched.length > 0) {
      failures.push(
        `${scenario.id}: top products should not include type ${forbiddenType}: ${matched.map(formatProduct).join(", ")}`,
      );
    }
  }

  for (const requiredType of scenario.expectations.requiredTypeCodesInTop ?? []) {
    const matched = topProducts.some((product) => product.typeCode === requiredType);
    if (!matched) {
      failures.push(
        `${scenario.id}: top products should include type ${requiredType}, got ${topProducts.map(formatProduct).join(", ")}`,
      );
    }
  }

  return {
    id: scenario.id,
    topProducts,
    rankedCandidates: ranking.rankedCandidates,
    failures,
  };
}

export function assertRecommendationEvalPasses(result: RecommendationEvalResult) {
  assert.deepEqual(result.failures, []);
}
