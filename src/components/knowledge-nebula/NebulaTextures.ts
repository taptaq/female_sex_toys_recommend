import { useEffect, useState } from "react";
import * as THREE from "three";

export type NebulaTextureSet = {
  softGlow: THREE.CanvasTexture;
  wispyCloud: THREE.CanvasTexture;
  starDust: THREE.CanvasTexture;
};

let cachedTextureSet: NebulaTextureSet | null = null;

function createCanvasTexture(
  size: number,
  paint: (context: CanvasRenderingContext2D, size: number) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create nebula texture canvas.");
  }

  paint(context, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function paintSoftGlow(context: CanvasRenderingContext2D, size: number) {
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center, 4, center, center, center);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.82)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.22)");
  gradient.addColorStop(0.74, "rgba(255,255,255,0.06)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
}

function paintWispyCloud(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);

  const center = size / 2;
  const base = context.createRadialGradient(center, center, 18, center, center, center);
  base.addColorStop(0, "rgba(255,255,255,0.9)");
  base.addColorStop(0.28, "rgba(255,255,255,0.38)");
  base.addColorStop(0.68, "rgba(255,255,255,0.12)");
  base.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = base;
  context.fillRect(0, 0, size, size);

  context.globalCompositeOperation = "source-over";
  for (let index = 0; index < 78; index += 1) {
    const angle = index * 0.54;
    const radius = size * (0.08 + (index % 13) * 0.026);
    const x = center + Math.cos(angle) * radius * 1.35;
    const y = center + Math.sin(angle * 0.82) * radius * 0.56;
    const gradient = context.createRadialGradient(
      x,
      y,
      2,
      x,
      y,
      size * (0.06 + (index % 5) * 0.018),
    );
    gradient.addColorStop(0, `rgba(255,255,255,${0.18 + (index % 4) * 0.045})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }

  context.globalCompositeOperation = "destination-out";
  for (let index = 0; index < 18; index += 1) {
    const angle = index * 0.92;
    const x = center + Math.cos(angle) * size * 0.24;
    const y = center + Math.sin(angle * 1.1) * size * 0.18;
    const cutout = context.createRadialGradient(x, y, 0, x, y, size * 0.1);
    cutout.addColorStop(0, "rgba(255,255,255,0.2)");
    cutout.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = cutout;
    context.fillRect(0, 0, size, size);
  }
  context.globalCompositeOperation = "source-over";

  context.globalCompositeOperation = "destination-in";
  const edgeFade = context.createRadialGradient(center, center, 0, center, center, center);
  edgeFade.addColorStop(0, "rgba(255,255,255,1)");
  edgeFade.addColorStop(0.48, "rgba(255,255,255,0.95)");
  edgeFade.addColorStop(0.76, "rgba(255,255,255,0.38)");
  edgeFade.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = edgeFade;
  context.fillRect(0, 0, size, size);
  context.globalCompositeOperation = "source-over";
}

function paintStarDust(context: CanvasRenderingContext2D, size: number) {
  context.clearRect(0, 0, size, size);

  for (let index = 0; index < 170; index += 1) {
    const x = (Math.sin(index * 91.7) * 0.5 + 0.5) * size;
    const y = (Math.sin(index * 37.3 + 1.4) * 0.5 + 0.5) * size;
    const radius = index % 17 === 0 ? 1.35 : index % 7 === 0 ? 0.95 : 0.52;
    const alpha = index % 17 === 0 ? 0.82 : index % 7 === 0 ? 0.52 : 0.32;

    context.beginPath();
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

export function createNebulaTextureSet(): NebulaTextureSet | null {
  if (cachedTextureSet) {
    return cachedTextureSet;
  }

  if (typeof document === "undefined") {
    return null;
  }

  cachedTextureSet = {
    softGlow: createCanvasTexture(256, paintSoftGlow),
    wispyCloud: createCanvasTexture(512, paintWispyCloud),
    starDust: createCanvasTexture(512, paintStarDust),
  };
  return cachedTextureSet;
}

export function useNebulaTextureSet() {
  const [textures, setTextures] = useState<NebulaTextureSet | null>(() => cachedTextureSet);

  useEffect(() => {
    setTextures(createNebulaTextureSet());
  }, []);

  return textures;
}
