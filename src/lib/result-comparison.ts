import type { RankedProduct } from "./app-shell.ts";

export type ResultComparisonRow = {
  id: string;
  label: string;
  values: string[];
};

function formatNoise(maxDb: number | null | undefined) {
  return maxDb == null ? "缺失" : `< ${maxDb}dB`;
}

function formatWaterproof(waterproof: number | null | undefined) {
  return waterproof == null ? "缺失" : `IPX${waterproof}`;
}

function formatPhysicalForm(physicalForm: RankedProduct["physicalForm"]) {
  if (physicalForm === "external") return "外部刺激";
  if (physicalForm === "internal") return "入体体验";
  return "复合刺激";
}

function formatBeginnerFit(product: Pick<RankedProduct, "motorType" | "waterproof">) {
  if (product.motorType === "gentle" && (product.waterproof ?? 0) >= 6) {
    return "更友好";
  }
  if (product.motorType === "gentle") return "偏温和";
  if ((product.waterproof ?? 0) >= 6) return "好打理";
  return "需适应";
}

function formatDisguise(appearance: RankedProduct["appearance"]) {
  return appearance === "high_disguise" ? "更隐蔽" : "更直接";
}

export function buildResultComparisonRows(
  products: RankedProduct[],
): ResultComparisonRow[] {
  const comparedProducts = products.slice(0, 3);

  return [
    {
      id: "price",
      label: "价格",
      values: comparedProducts.map((product) => `¥${product.price}`),
    },
    {
      id: "noise",
      label: "静音",
      values: comparedProducts.map((product) => formatNoise(product.maxDb)),
    },
    {
      id: "waterproof",
      label: "防水",
      values: comparedProducts.map((product) => formatWaterproof(product.waterproof)),
    },
    {
      id: "physical-form",
      label: "刺激路线",
      values: comparedProducts.map((product) => formatPhysicalForm(product.physicalForm)),
    },
    {
      id: "beginner-fit",
      label: "新手友好",
      values: comparedProducts.map(formatBeginnerFit),
    },
    {
      id: "disguise",
      label: "隐蔽性",
      values: comparedProducts.map((product) => formatDisguise(product.appearance)),
    },
  ];
}
