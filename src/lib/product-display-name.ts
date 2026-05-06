import type { Product } from "../data/mock.ts";

const SENSITIVE_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/情趣用品|成人用品/gi, "个人护理用品"],
  [/情趣玩具|成人玩具|sex[\s-]*toys?|adult[\s-]*toys?/gi, "个人护理器具"],
  [/情趣|成人/gi, "个人护理"],
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildSafeDisplayName(rawName: string) {
  const normalized = normalizeWhitespace(String(rawName || ""));
  if (!normalized) {
    return "个人护理商品";
  }

  const withoutPlaceholderTokens = normalized
    .replace(/q{2,}/gi, " ")
    .replace(/[（(]qq+[)）]/gi, " ")
    .replace(/[【[]qq+[\]】]/gi, " ");

  const neutralized = SENSITIVE_NAME_REPLACEMENTS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    withoutPlaceholderTokens,
  )
    .replace(/个人护理(?:用品|器具|商品)?个人护理/gi, "个人护理")
    .replace(/个人护理\s+个人护理/gi, "个人护理")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([/|,，])/g, "$1")
    .replace(/([/|,，])\s+/g, "$1")
    .trim();

  return neutralized || "个人护理商品";
}

export function getProductDisplayName(
  product: Pick<Product, "name" | "safeDisplayName" | "displayName">,
) {
  return (
    normalizeWhitespace(product.displayName || "") ||
    normalizeWhitespace(product.safeDisplayName || "") ||
    buildSafeDisplayName(product.name)
  );
}
