import type { Product } from "../data/mock.js";

export type RecommendationEvidenceSignal =
  | "suction"
  | "insertable"
  | "material"
  | "fantasy"
  | "accessory"
  | "appOrRemote"
  | "couple"
  | "patterns"
  | "intensity";

export type RecommendationEvidenceSnippet = {
  signal: RecommendationEvidenceSignal;
  text: string;
  polarity: "positive" | "negative";
  source: "name" | "tag" | "rawDescription" | "structured";
};

export type RecommendationProductFeatures = {
  haystack: string;
  isSuctionLike: boolean;
  isInsertableLike: boolean;
  supportsAppOrRemote: boolean;
  isCoupleOriented: boolean;
  hasManyPatterns: boolean;
  hasStrongSuctionSignal: boolean;
  hasGentleSignal: boolean;
  hasStrongIntensitySignal: boolean;
  evidence: RecommendationEvidenceSnippet[];
};

export function buildRecommendationProductHaystack(product: Product) {
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

function hasAppOrRemoteSignal(text: string) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return false;
  if (
    /非\s*app|不是\s*app|不带\s*app|无\s*app|非\s*远控|不是\s*远控|不带\s*远控|无\s*远控|非\s*遥控|不是\s*遥控|非\s*异地|不是\s*异地|not\s*app|without\s*app|not\s*remote|without\s*remote/.test(
      normalized,
    )
  ) {
    return false;
  }
  return /app|远控|遥控|异地|remote/.test(normalized);
}

function hasCoupleSignal(text: string) {
  return /情侣|双人|共玩|互动|couple|partner/.test(String(text || "").toLowerCase());
}

type ProductTextSource = {
  text: string;
  source: RecommendationEvidenceSnippet["source"];
};

function splitEvidenceText(text: string) {
  return String(text || "")
    .split(/(?<=[。！？!?；;])\s*|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getProductEvidenceTextSources(product: Product): ProductTextSource[] {
  const nameSources = [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
  ]
    .map((text) => String(text || "").trim())
    .filter(Boolean)
    .map((text) => ({ text, source: "name" as const }));

  const rawDescriptionSources = splitEvidenceText(product.rawDescription ?? "").map(
    (text) => ({
      text,
      source: "rawDescription" as const,
    }),
  );

  const tagSources = (product.tags ?? [])
    .map((text) => String(text || "").trim())
    .filter(Boolean)
    .map((text) => ({ text, source: "tag" as const }));

  return [...rawDescriptionSources, ...tagSources, ...nameSources];
}

function pushEvidenceIfMatch(
  evidence: RecommendationEvidenceSnippet[],
  sources: ProductTextSource[],
  signal: RecommendationEvidenceSignal,
  polarity: RecommendationEvidenceSnippet["polarity"],
  pattern: RegExp,
  options: { skipWhenNegativeExists?: boolean } = {},
) {
  for (const source of sources) {
    if (pattern.test(source.text.toLowerCase())) {
      if (
        options.skipWhenNegativeExists &&
        evidence.some(
          (item) =>
            item.signal === signal &&
            item.polarity === "negative" &&
            item.text === source.text,
        )
      ) {
        continue;
      }

      evidence.push({
        signal,
        polarity,
        text: source.text,
        source: source.source,
      });
    }
  }
}

function buildRecommendationEvidence(product: Product): RecommendationEvidenceSnippet[] {
  const sources = getProductEvidenceTextSources(product);
  const evidence: RecommendationEvidenceSnippet[] = [];
  const haystack = buildRecommendationProductHaystack(product);

  pushEvidenceIfMatch(
    evidence,
    sources,
    "suction",
    "negative",
    /不是吮吸|非吮吸|不带吮吸|无吮吸|not suction|non-suction/,
  );
  pushEvidenceIfMatch(
    evidence,
    sources,
    "suction",
    "positive",
    /吮吸|吸感|吸吮|小海豚|阴蒂吸|air ?pulse|suction/,
    { skipWhenNegativeExists: true },
  );
  pushEvidenceIfMatch(
    evidence,
    sources,
    "appOrRemote",
    "negative",
    /非\s*app|不是\s*app|不带\s*app|无\s*app|非\s*远控|不是\s*远控|不带\s*远控|无\s*远控|非\s*遥控|不是\s*遥控|非\s*异地|不是\s*异地|not\s*app|without\s*app|not\s*remote|without\s*remote/,
  );
  pushEvidenceIfMatch(
    evidence,
    sources,
    "appOrRemote",
    "positive",
    /app|远控|遥控|异地|remote/,
    { skipWhenNegativeExists: true },
  );
  pushEvidenceIfMatch(
    evidence,
    sources,
    "insertable",
    "positive",
    /入体|插入|深入|内外|双刺激|双通道|g点|g\s*点|insertable/,
  );
  pushEvidenceIfMatch(evidence, sources, "couple", "positive", /情侣|双人|共玩|互动|couple|partner/);
  pushEvidenceIfMatch(evidence, sources, "patterns", "positive", /波形|模式|档位|频率|节奏|变化/);
  pushEvidenceIfMatch(evidence, sources, "intensity", "positive", /强劲|强力|高能|爆发|大吸力|强吸/);
  pushEvidenceIfMatch(evidence, sources, "intensity", "negative", /温和|柔和|新手|慢热/);

  if (product.typeCode === "suction" || product.subtypeCode?.includes("suction") === true) {
    evidence.push({
      signal: "suction",
      polarity: "positive",
      text: "商品类型标记为吮吸路线",
      source: "structured",
    });
  }

  if (
    product.typeCode === "insertable" ||
    product.subtypeCode === "gspot_insertable" ||
    product.subtypeCode === "insertable_vibe" ||
    product.physicalForm === "internal" ||
    product.physicalForm === "composite"
  ) {
    evidence.push({
      signal: "insertable",
      polarity: "positive",
      text: "商品结构标记为入体探索路线",
      source: "structured",
    });
  }

  if (/硅胶|silicone|platinum silicone|body-safe|non-porous|无孔|身体安全|铂金级/.test(haystack)) {
    evidence.push({
      signal: "material",
      polarity: "positive",
      text: "商品材质标记为硅胶/身体安全材质",
      source: "structured",
    });
  }

  if (/幻想|奇幻|fantasy|怪物|生物|creature|dragon|tentacle|knot|paw|pony|glow|luminous|夜光|收藏|collect/i.test(haystack)) {
    evidence.push({
      signal: "fantasy",
      polarity: "positive",
      text: "商品描述命中幻想造型或收藏风格",
      source: "structured",
    });
  }

  if (
    product.typeCode === "bdsm" ||
    product.subtypeCode === "fetish_accessory" ||
    /harness|keychain|mystery box|monthly drop|束具|钥匙链|神秘盒|周边|配件/i.test(haystack)
  ) {
    evidence.push({
      signal: "accessory",
      polarity: "positive",
      text: "商品类型或描述标记为周边/配件路线",
      source: "structured",
    });
  }

  return evidence.filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.signal === item.signal &&
          candidate.polarity === item.polarity &&
          candidate.text === item.text,
      ) === index,
  );
}

export function buildRecommendationProductFeatures(
  product: Product,
): RecommendationProductFeatures {
  const haystack = buildRecommendationProductHaystack(product);
  const evidence = buildRecommendationEvidence(product);
  const isSuctionLike =
    product.typeCode === "suction" ||
    product.subtypeCode?.includes("suction") === true ||
    hasPositiveSuctionSignal(haystack);
  const isInsertableLike =
    product.physicalForm !== "external" ||
    /入体|插入|深入|内外|双刺激|双通道|g点|g\s*点|insertable/.test(haystack);

  return {
    haystack,
    isSuctionLike,
    isInsertableLike,
    supportsAppOrRemote: hasAppOrRemoteSignal(haystack),
    isCoupleOriented: product.gender === "unisex" || hasCoupleSignal(haystack),
    hasManyPatterns: /波形|模式|档位|频率|节奏|变化/.test(haystack),
    hasStrongSuctionSignal: /强劲|强力|高能|爆发|大吸力|强吸/.test(haystack),
    hasGentleSignal: product.motorType === "gentle" || /温和|柔和|新手|慢热/.test(haystack),
    hasStrongIntensitySignal:
      product.motorType === "strong" || /强劲|强力|高能|爆发|大吸力|强吸/.test(haystack),
    evidence,
  };
}
