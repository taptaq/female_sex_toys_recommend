import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { MotherCloudBand } from "../../lib/knowledge-nebula-mother-cloud.ts";
import type { NebulaTextureSet } from "./NebulaTextures.ts";

type MotherCloudFieldProps = {
  bands: MotherCloudBand[];
  textures: NebulaTextureSet;
  phase: number;
  isFocused: boolean;
};

type MotherCloudBandSpriteProps = {
  band: MotherCloudBand;
  index: number;
  textures: NebulaTextureSet;
  phase: number;
  isFocused: boolean;
};

function MotherCloudBandSprite({
  band,
  index,
  textures,
  phase,
  isFocused,
}: MotherCloudBandSpriteProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);
  const texture = band.role === "core" ? textures.softGlow : textures.wispyCloud;
  const phaseOpacity = band.opacity * (0.42 + phase * 0.58);
  const focusFade = isFocused && band.role === "veil" ? 0.72 : 1;

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    const sprite = spriteRef.current;
    const material = materialRef.current;
    const pulse = 1 + Math.sin(elapsed * band.driftSpeed * 18 + index) * band.pulse;

    if (sprite) {
      sprite.position.set(
        band.position[0] + Math.sin(elapsed * band.driftSpeed + index) * 0.08,
        band.position[1] + Math.cos(elapsed * band.driftSpeed * 0.9 + index) * 0.05,
        band.position[2],
      );
      sprite.scale.set(
        band.scale[0] * pulse,
        band.scale[1] * (1 + (pulse - 1) * 0.65),
        band.scale[2],
      );
    }

    if (material) {
      material.opacity = phaseOpacity * focusFade;
      material.rotation =
        band.rotationZ + Math.sin(elapsed * band.driftSpeed * 0.8 + index) * 0.025;
    }
  });

  return (
    <sprite
      ref={spriteRef}
      position={band.position}
      scale={band.scale}
      renderOrder={index}
    >
      <spriteMaterial
        ref={materialRef}
        map={texture}
        color={band.tint}
        rotation={band.rotationZ}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={phaseOpacity * focusFade}
      />
    </sprite>
  );
}

export function MotherCloudField({
  bands,
  textures,
  phase,
  isFocused,
}: MotherCloudFieldProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    group.rotation.z = Math.sin(elapsed * 0.025) * 0.018;
    group.position.z = isFocused ? -0.28 : 0;
  });

  return (
    <group ref={groupRef}>
      {bands.map((band, index) => (
        <MotherCloudBandSprite
          key={band.id}
          band={band}
          index={index}
          textures={textures}
          phase={phase}
          isFocused={isFocused}
        />
      ))}
    </group>
  );
}
