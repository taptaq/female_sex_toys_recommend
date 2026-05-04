import { Sparkles } from "@react-three/drei";
import type { StarFieldLayer } from "../../lib/knowledge-nebula-mother-cloud.ts";

type NebulaStarFieldProps = {
  layers: StarFieldLayer[];
  speedScale?: number;
};

export function NebulaStarField({ layers, speedScale = 1 }: NebulaStarFieldProps) {
  return (
    <>
      {layers.map((layer) => (
        <Sparkles
          key={`${layer.id}-${layer.count}-${layer.scale.join("x")}`}
          count={layer.count}
          color={layer.color}
          size={layer.size}
          scale={layer.scale}
          speed={layer.speed * speedScale}
          opacity={layer.opacity}
          noise={layer.depth === "far" ? 0.9 : layer.depth === "mid" ? 0.55 : 0.25}
        />
      ))}
    </>
  );
}
