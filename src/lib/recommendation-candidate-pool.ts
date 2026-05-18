import type { AnswerState, Product } from "../data/mock.js";
import { resolveLibraryTypeCode } from "./library-product-type-classifier.js";

export type RecommendationCandidatePool = {
  filteredProducts: Product[];
  relaxedProducts: Product[];
  rankedInputProducts: Product[];
};

export type RecommendationCandidatePoolContext = {
  naturalLanguageQuery?: string;
};

function buildNaturalLanguageProductHaystack(product: Product) {
  return [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
    product.rawDescription,
    ...(product.tags ?? []),
    product.typeCode,
    product.subtypeCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasPositiveSuctionSignal(text: string) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return false;
  if (/不是吮吸|非吮吸|不带吮吸|无吮吸|not suction|non-suction/.test(normalized)) {
    return false;
  }
  return /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/.test(normalized);
}

function isSuctionLikeProduct(product: Product) {
  const haystack = buildNaturalLanguageProductHaystack(product);
  return (
    product.typeCode === "suction" ||
    product.subtypeCode?.includes("suction") === true ||
    hasPositiveSuctionSignal(haystack)
  );
}

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
    const lowerQuery = naturalLanguageQuery.toLowerCase();
    const expressesSuctionPreference =
      /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/.test(lowerQuery);
    const expressesStrongSuctionPreference =
      /吮吸感更强|更强吮吸|更强吸感|吸力更强|吸感更强/.test(lowerQuery);
    const explicitlyAllowsInsertable =
      /入体|插入|深入|内外|双刺激|双通道|g点|g\s*点/.test(lowerQuery);

    if (expressesStrongSuctionPreference && !isSuctionLikeProduct(product)) {
      return false;
    }

    if (
      expressesSuctionPreference &&
      !explicitlyAllowsInsertable &&
      product.physicalForm !== "external"
    ) {
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
    rankedInputProducts:
      filteredProducts.length >= 3 ? filteredProducts : relaxedProducts,
  };
}
