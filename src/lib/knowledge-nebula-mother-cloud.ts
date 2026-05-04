import type { KnowledgeNebulaViewport } from "./knowledge-nebula-field.ts";

export type StarFieldLayer = {
  id: string;
  depth: "far" | "mid" | "near";
  count: number;
  scale: [number, number, number];
  size: number;
  opacity: number;
  speed: number;
  color: string;
};

export function buildStarFieldLayers(
  viewport: KnowledgeNebulaViewport,
  maxTotalCount?: number,
): StarFieldLayer[] {
  const mobile = viewport === "mobile";
  const layers: StarFieldLayer[] = [
    {
      id: "far-stars",
      depth: "far",
      count: mobile ? 250 : 560,
      scale: mobile ? [12, 10, 8] : [22, 14, 12],
      size: mobile ? 1.15 : 1.3,
      opacity: 0.62,
      speed: 0.035,
      color: "#dbeafe",
    },
    {
      id: "mid-stars",
      depth: "mid",
      count: mobile ? 125 : 280,
      scale: mobile ? [9, 7.4, 7] : [15, 9.8, 9],
      size: mobile ? 1.95 : 2.2,
      opacity: 0.56,
      speed: 0.07,
      color: "#f5d0fe",
    },
    {
      id: "near-stars",
      depth: "near",
      count: mobile ? 52 : 96,
      scale: mobile ? [7, 5.4, 5] : [12, 7.4, 7],
      size: mobile ? 3.2 : 3.8,
      opacity: 0.48,
      speed: 0.12,
      color: "#ffffff",
    },
  ];

  if (!maxTotalCount) {
    return layers;
  }

  const totalCount = layers.reduce((sum, layer) => sum + layer.count, 0);
  const ratio = Math.min(1, maxTotalCount / totalCount);

  return layers.map((layer) => ({
    ...layer,
    count: Math.max(18, Math.round(layer.count * ratio)),
  }));
}
