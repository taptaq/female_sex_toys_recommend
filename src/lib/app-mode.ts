import type { AnswerState, Product } from "../data/mock.ts";

export const APP_MODE = "female-mvp" as const;

export type AppMode = typeof APP_MODE;

export type MvpEntry =
  | "start-match"
  | "favorites"
  | "library"
  | "knowledge"
  | "profiles"
  | "body-persona"
  | "theme-switcher";

export const DEFAULT_MVP_ANSWERS: AnswerState = {
  gender: "female",
  tags: ["女性向"],
};

const FEMALE_MVP_ENTRIES = new Set<MvpEntry>(["start-match", "favorites"]);
const FEMALE_SIGNALS = [
  "女性",
  "女生",
  "女用",
  "她",
  "阴蒂",
  "外部",
  "吸吮",
  "吮吸",
  "跳蛋",
  "震动棒",
  "按摩棒",
  "G点",
  "盆底",
  "凯格尔",
];
const MALE_ONLY_SIGNALS = ["男性", "男士", "飞机杯", "阴茎", "前列腺", "龟头", "锁精", "阴茎环"];

export const FEMALE_MVP_FALLBACK_PRODUCTS: Product[] = [
  {
    id: "female-mvp-gentle-suction",
    name: "Luna Soft Air",
    displayName: "Luna Soft Air",
    safeDisplayName: "Luna Soft Air",
    canonicalName: "Luna Soft Air",
    price: 269,
    maxDb: 42,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    typeCode: "suction",
    subtypeCode: "clitoral_suction",
    brand: "Luna Lab",
    material: "亲肤硅胶",
    imagePlaceholder: "",
    rawDescription: "女性向外部吮吸路线，温和低噪，适合新手慢热探索。",
    tags: ["女性向", "外部刺激", "吮吸", "新手友好", "静音"],
  },
  {
    id: "female-mvp-pocket-vibe",
    name: "Pocket Star Vibe",
    displayName: "Pocket Star Vibe",
    safeDisplayName: "Pocket Star Vibe",
    canonicalName: "Pocket Star Vibe",
    price: 189,
    maxDb: 45,
    waterproof: 7,
    appearance: "high_disguise",
    physicalForm: "external",
    motorType: "gentle",
    gender: "female",
    typeCode: "external_vibe",
    subtypeCode: "bullet_vibe",
    brand: "Luna Lab",
    material: "亲肤硅胶",
    imagePlaceholder: "",
    rawDescription: "女性外部震动，便携跳蛋形态，低存在感收纳，适合隐私友好场景。",
    tags: ["女性向", "跳蛋", "便携", "隐蔽收纳", "静音"],
  },
  {
    id: "female-mvp-dual-starter",
    name: "Comet Dual Starter",
    displayName: "Comet Dual Starter",
    safeDisplayName: "Comet Dual Starter",
    canonicalName: "Comet Dual Starter",
    price: 329,
    maxDb: 48,
    waterproof: 7,
    appearance: "normal",
    physicalForm: "composite",
    motorType: "gentle",
    gender: "female",
    typeCode: "dual_stimulation",
    subtypeCode: "rabbit_vibe",
    brand: "Luna Lab",
    material: "亲肤硅胶",
    imagePlaceholder: "",
    rawDescription: "女性向内外复合刺激，兔耳外部反馈，适合想逐步进阶的探索。",
    tags: ["女性向", "复合机型", "兔耳", "防水", "进阶友好"],
  },
];

export function shouldUseFemaleMvp(mode: AppMode = APP_MODE): boolean {
  return mode === "female-mvp";
}

export function canShowMvpEntry(entry: MvpEntry, mode: AppMode = APP_MODE): boolean {
  if (!shouldUseFemaleMvp(mode)) {
    return true;
  }

  return FEMALE_MVP_ENTRIES.has(entry);
}

export function isFemaleMvpEligibleProduct(product: Product): boolean {
  if (product.gender === "female") {
    return true;
  }

  if (product.gender === "male") {
    return false;
  }

  const searchableText = [
    product.name,
    product.displayName,
    product.safeDisplayName,
    product.canonicalName,
    product.rawDescription,
    ...(product.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  const hasFemaleSignal = FEMALE_SIGNALS.some((signal) => searchableText.includes(signal));
  const hasMaleOnlySignal = MALE_ONLY_SIGNALS.some((signal) => searchableText.includes(signal));

  return hasFemaleSignal && !hasMaleOnlySignal;
}

export function filterFemaleMvpProducts(products: Product[]): Product[] {
  const eligibleProducts = products.filter(isFemaleMvpEligibleProduct);
  return eligibleProducts.length > 0 ? eligibleProducts : FEMALE_MVP_FALLBACK_PRODUCTS;
}
