export type BrandBrief = {
  brandName: string;
  brandSlug: string;
  countryLabel?: string;
  positioning: string;
  styleSummary: string;
  officialWebsiteUrl?: string;
};

import { findCompetitorRegistryConfig } from "../scraper/shared/competitor-registry.ts";

type BrandBriefSource = {
  brand?: string | null;
  country?: string | null;
  description?: string | null;
  focus?: string | null;
  majorUserGroupProfile?: string | null;
  philosophy?: string[] | null;
  officialWebsiteUrl?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_LABEL_MAP = new Map<string, string>([
  ["中国", "中国"],
  ["china", "中国"],
  ["美国", "美国"],
  ["usa", "美国"],
  ["united states", "美国"],
  ["united states of america", "美国"],
  ["德国", "德国"],
  ["germany", "德国"],
  ["英国", "英国"],
  ["uk", "英国"],
  ["united kingdom", "英国"],
  ["日本", "日本"],
  ["japan", "日本"],
  ["加拿大", "加拿大"],
  ["canada", "加拿大"],
  ["法国", "法国"],
  ["france", "法国"],
  ["瑞典", "瑞典"],
  ["sweden", "瑞典"],
  ["荷兰", "荷兰"],
  ["netherlands", "荷兰"],
]);

function normalizeCountryLabel(country: string | null | undefined) {
  const normalized = normalizeText(country);
  if (!normalized) return undefined;
  return COUNTRY_LABEL_MAP.get(normalized.toLowerCase()) ?? normalized;
}

function normalizeOfficialWebsiteUrl(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  try {
    const url = new URL(
      normalized.startsWith("http://") || normalized.startsWith("https://")
        ? normalized
        : `https://${normalized}`,
    );
    return `${url.protocol}//${url.host}/`;
  } catch {
    return undefined;
  }
}

export function buildBrandSlug(value: string | null | undefined) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "brand";
}

function pickFirstSentence(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  const match = normalized.match(/^(.+?[。！？.!?])(?:\s|$)/u);
  return (match?.[1] || normalized).trim();
}

function extractStyleSummaryFromPhilosophy(philosophy: string[] | null | undefined) {
  const items = Array.isArray(philosophy)
    ? philosophy.map((item) => normalizeText(item)).filter(Boolean)
    : [];

  if (items.length === 0) return "";
  return pickFirstSentence(items[0]);
}

function extractStyleSummaryFromPersona(majorUserGroupProfile: string | null | undefined) {
  const normalized = normalizeText(majorUserGroupProfile);
  if (!normalized) return "";

  const match = normalized.match(/【心理特征】([^【]+)/u);
  if (!match?.[1]) return "";
  return `${match[1].trim()}。`;
}

function buildFallbackPositioning(brandName: string, focus: string | null | undefined) {
  const normalizedFocus = normalizeText(focus).toLowerCase();

  if (normalizedFocus === "female") {
    return `${brandName} 是偏女性向体验与身体友好表达的品牌。`;
  }
  if (normalizedFocus === "male") {
    return `${brandName} 是偏男性向体验与功能导向选择的品牌。`;
  }
  return `${brandName} 是兼顾多场景体验与不同使用状态的品牌。`;
}

function buildFallbackStyleSummary(focus: string | null | undefined) {
  const normalizedFocus = normalizeText(focus).toLowerCase();

  if (normalizedFocus === "female") {
    return "整体风格更细腻、友好，也更强调轻压力进入体验。";
  }
  if (normalizedFocus === "male") {
    return "整体风格更直接、功能导向，也更强调结构与反馈效率。";
  }
  return "整体风格更偏通用与场景适配，也更强调稳定决策成本。";
}

export function buildBrandBrief(source: BrandBriefSource): BrandBrief | null {
  const brandName = normalizeText(source.brand);
  if (!brandName) return null;

  const countryLabel = normalizeCountryLabel(source.country);
  const positioning =
    pickFirstSentence(source.description) ||
    buildFallbackPositioning(brandName, source.focus);
  const styleSummary =
    extractStyleSummaryFromPhilosophy(source.philosophy) ||
    extractStyleSummaryFromPersona(source.majorUserGroupProfile) ||
    buildFallbackStyleSummary(source.focus);

  return {
    brandName,
    brandSlug: buildBrandSlug(brandName),
    countryLabel,
    positioning,
    styleSummary,
    officialWebsiteUrl: normalizeOfficialWebsiteUrl(source.officialWebsiteUrl),
  };
}

export function resolveBrandBrief(
  brandBrief: BrandBrief | null | undefined,
  brandName: string | null | undefined,
) {
  if (brandBrief) {
    return {
      ...brandBrief,
      countryLabel: normalizeCountryLabel(brandBrief.countryLabel),
    };
  }

  const normalizedBrandName = normalizeText(brandName);
  if (!normalizedBrandName) {
    return null;
  }

  const registryConfig = findCompetitorRegistryConfig(normalizedBrandName);
  if (registryConfig) {
    return buildBrandBrief({
      brand: registryConfig.canonicalName,
      country: registryConfig.country,
      description: registryConfig.description,
      focus: registryConfig.focus,
      philosophy: registryConfig.philosophy,
      majorUserGroupProfile: registryConfig.majorUserGroupProfile,
      officialWebsiteUrl: registryConfig.domain,
    });
  }

  return buildBrandBrief({ brand: normalizedBrandName });
}
