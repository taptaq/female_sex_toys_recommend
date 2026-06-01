import type { AnswerState, Product } from "../data/mock.js";
import { resolveLibraryTypeCode } from "./library-product-type-classifier.js";
import { parseNaturalLanguageRecommendationIntent } from "./recommendation-natural-language-intent.js";
import { buildRecommendationProductFeatures } from "./recommendation-product-features.js";

export type RecommendationCandidatePool = {
  filteredProducts: Product[];
  relaxedProducts: Product[];
  rankedInputProducts: Product[];
};

export type RecommendationCandidatePoolContext = {
  naturalLanguageQuery?: string;
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
  context?: RecommendationCandidatePoolContext,
) {
  if (!isRecommendationEligibleProduct(product)) {
    return false;
  }

  const naturalLanguageQuery = String(context?.naturalLanguageQuery || "").trim();
  if (naturalLanguageQuery) {
    const intent = parseNaturalLanguageRecommendationIntent(naturalLanguageQuery);
    const features = buildRecommendationProductFeatures(product);

    if (intent.must.suctionProduct && !features.isSuctionLike) {
      return false;
    }

    if (intent.avoid.insertable && features.isInsertableLike) {
      return false;
    }

    if (intent.must.externalOnly && product.physicalForm !== "external") {
      return false;
    }

    if (intent.avoid.appOrRemote && features.supportsAppOrRemote) {
      return false;
    }

    if (intent.avoid.couple && features.isCoupleOriented) {
      return false;
    }
  }

  if (answers.gender === "unisex") {
    if (
      answers.partnerComposition === "male_male" &&
      product.gender === "female"
    ) {
      return false;
    }

    if (
      answers.partnerComposition === "female_female" &&
      product.gender === "male"
    ) {
      return false;
    }

    return true;
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

  if (
    answers.waterproof &&
    product.waterproof != null &&
    product.waterproof < answers.waterproof
  ) {
    return false;
  }

  return true;
}

export function buildRecommendationCandidatePool(
  answers: AnswerState,
  products: Product[],
  context?: RecommendationCandidatePoolContext,
): RecommendationCandidatePool {
  const relaxedProducts = products.filter((product) =>
    matchesRecommendationHardConstraints(answers, product, context),
  );
  const filteredProducts = relaxedProducts.filter((product) =>
    matchesRecommendationSoftConstraints(answers, product),
  );

  return {
    filteredProducts,
    relaxedProducts,
    rankedInputProducts: filteredProducts,
  };
}
