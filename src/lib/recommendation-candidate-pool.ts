import type { AnswerState, Product } from "../data/mock.ts";
import { resolveLibraryTypeCode } from "./library-product-type-classifier.ts";

export type RecommendationCandidatePool = {
  filteredProducts: Product[];
  relaxedProducts: Product[];
  rankedInputProducts: Product[];
};

function resolveProductTypeCode(product: Product) {
  return resolveLibraryTypeCode(product.typeCode, {
    typeCode: product.typeCode,
    gender: product.gender,
    physicalForm: product.physicalForm,
    name: product.canonicalName || product.name,
    rawDescription: product.rawDescription ?? null,
    tags: product.tags ?? [],
  });
}

export function isRecommendationEligibleProduct(product: Product) {
  return resolveProductTypeCode(product) !== "care_accessory";
}

function matchesRecommendationHardConstraints(
  answers: AnswerState,
  product: Product,
) {
  if (!isRecommendationEligibleProduct(product)) {
    return false;
  }

  if (
    answers.gender &&
    product.gender !== "unisex" &&
    product.gender !== answers.gender
  ) {
    return false;
  }

  return true;
}

function matchesRecommendationSoftConstraints(
  answers: AnswerState,
  product: Product,
) {
  if (
    answers.budget &&
    (product.price < answers.budget[0] || product.price > answers.budget[1])
  ) {
    return false;
  }

  if (
    answers.maxDb &&
    product.maxDb != null &&
    product.maxDb > answers.maxDb
  ) {
    return false;
  }

  if (
    answers.appearance === "high_disguise" &&
    product.appearance !== "high_disguise"
  ) {
    return false;
  }

  return true;
}

export function buildRecommendationCandidatePool(
  answers: AnswerState,
  products: Product[],
): RecommendationCandidatePool {
  const relaxedProducts = products.filter((product) =>
    matchesRecommendationHardConstraints(answers, product),
  );
  const filteredProducts = relaxedProducts.filter((product) =>
    matchesRecommendationSoftConstraints(answers, product),
  );

  return {
    filteredProducts,
    relaxedProducts,
    rankedInputProducts:
      filteredProducts.length >= 3 ? filteredProducts : relaxedProducts,
  };
}
