import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { KnowledgeNebulaTopic } from "../../data/knowledge-nebula.ts";
import type { KnowledgeNebulaClusterAnchor } from "../../lib/knowledge-nebula-field.ts";
import type { TopicGlowProfile } from "../../lib/knowledge-nebula-mother-cloud.ts";
import type { NebulaTextureSet } from "./NebulaTextures.ts";

const ACCENT_COLORS: Record<
  KnowledgeNebulaTopic["accent"],
  {
    glow: string;
    edge: string;
    core: string;
  }
> = {
  cyan: {
    glow: "#22d3ee",
    edge: "#67e8f9",
    core: "#cffafe",
  },
  sky: {
    glow: "#38bdf8",
    edge: "#7dd3fc",
    core: "#e0f2fe",
  },
  indigo: {
    glow: "#818cf8",
    edge: "#a5b4fc",
    core: "#e0e7ff",
  },
};

type NebulaClusterProps = {
  anchor: KnowledgeNebulaClusterAnchor;
  glowProfile: TopicGlowProfile;
  accent: KnowledgeNebulaTopic["accent"];
  phase: number;
  isFocused: boolean;
  textures: NebulaTextureSet;
};

const SHAPE_ROTATION: Record<TopicGlowProfile["shape"], number> = {
  comet: -0.32,
  rift: 0.18,
  plume: -0.08,
  halo: 0.04,
  wake: 0.28,
};

export function NebulaCluster({
  anchor,
  glowProfile,
  accent,
  phase,
  isFocused,
  textures,
}: NebulaClusterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleTargetRef = useRef(new THREE.Vector3(1, 1, 1));
  const palette = ACCENT_COLORS[accent];
  const visiblePhase = THREE.MathUtils.clamp(phase, 0, 1);
  const focusBoost = isFocused ? 1 : 0;

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    const drift = anchor.driftAmplitude * (anchor.viewport === "mobile" ? 0.72 : 1);
    const settle = 0.34 + visiblePhase * 0.66;
    const focusScale = 1 + focusBoost * 0.16;

    group.position.set(
      anchor.position[0] + Math.sin(elapsed * 0.26 + anchor.xPercent * 0.08) * drift,
      anchor.position[1] + Math.cos(elapsed * 0.32 + anchor.yPercent * 0.07) * drift * 0.7,
      anchor.position[2] + Math.sin(elapsed * 0.18 + anchor.scale) * drift * 0.45,
    );
    group.rotation.z = Math.sin(elapsed * 0.18 + anchor.xPercent * 0.02) * 0.08 * settle;
    group.rotation.x = Math.cos(elapsed * 0.12 + anchor.yPercent * 0.03) * 0.04 * settle;

    scaleTargetRef.current.setScalar(anchor.scale * settle * focusScale);
    group.scale.lerp(scaleTargetRef.current, 0.08);
  });

  return (
    <group ref={groupRef} position={anchor.position}>
      <sprite
        position={glowProfile.cloudOffset}
        scale={glowProfile.cloudScale}
        renderOrder={0}
      >
        <spriteMaterial
          map={textures.wispyCloud}
          color={glowProfile.tint}
          rotation={SHAPE_ROTATION[glowProfile.shape]}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={glowProfile.opacity * (0.24 + visiblePhase * 0.76 + focusBoost * 0.35)}
        />
      </sprite>

      <sprite
        position={[glowProfile.cloudOffset[0] * -0.4, glowProfile.cloudOffset[1] * 0.6, 0.08]}
        scale={[glowProfile.cloudScale[0] * 0.52, glowProfile.cloudScale[1] * 0.58, 1]}
        renderOrder={1}
      >
        <spriteMaterial
          map={textures.softGlow}
          color={palette.core}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.1 + visiblePhase * 0.14 + focusBoost * 0.18}
        />
      </sprite>

      <sprite
        position={[0, 0, -0.12]}
        scale={[glowProfile.cloudScale[0] * 0.72, glowProfile.cloudScale[1] * 0.44, 1]}
        renderOrder={2}
      >
        <spriteMaterial
          map={textures.starDust}
          color={palette.edge}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.05 + visiblePhase * 0.1 + focusBoost * 0.08}
        />
      </sprite>
    </group>
  );
}
