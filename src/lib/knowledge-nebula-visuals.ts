export type NebulaTextureVariant = {
  widthMultiplier: number;
  opacity: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  background: string;
  filter: string;
  mask: string;
  idleDuration: number;
  hoverScale: number;
  hoverOpacityBoost: number;
};

export type NebulaFocusMotion = {
  warpScaleStart: number;
  warpScaleMid: number;
  warpScaleEnd: number;
  ringScaleStart: number;
  ringScaleMid: number;
  ringScaleEnd: number;
  warpPeakOpacity: number;
  ringPeakOpacity: number;
};

export type ShootingStar = {
  id: string;
  top: number;
  left: number;
  width: number;
  angle: number;
  travelX: number;
  travelY: number;
  delay: number;
  duration: number;
  repeatDelay: number;
};

const NEBULA_CORE_SPARKLES = [
  "radial-gradient(circle at 34% 50%, rgba(255,255,255,0.88) 0 1.25px, transparent 1.8px)",
  "radial-gradient(circle at 47% 44%, rgba(255,255,255,0.74) 0 1.05px, transparent 1.65px)",
  "radial-gradient(circle at 58% 55%, rgba(186,230,253,0.76) 0 1.05px, transparent 1.75px)",
  "radial-gradient(circle at 66% 47%, rgba(245,208,254,0.68) 0 1.1px, transparent 1.85px)",
] as const;

const TEXTURE_VARIANTS: readonly NebulaTextureVariant[] = [
  {
    widthMultiplier: 2.08,
    opacity: 0.46,
    rotate: -14,
    scaleX: 1.18,
    scaleY: 0.74,
    background:
      [
        ...NEBULA_CORE_SPARKLES,
        "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.82) 0 9%, transparent 18%)",
        "radial-gradient(ellipse at 44% 50%, rgba(240,171,252,0.92) 0 19%, transparent 42%)",
        "radial-gradient(ellipse at 59% 50%, rgba(125,211,252,0.46) 0 17%, transparent 37%)",
      ].join(","),
    filter: "contrast(1.12) saturate(1.16) brightness(1.04)",
    mask: "radial-gradient(ellipse 56% 36% at 50% 50%, black 34%, rgba(0,0,0,0.9) 54%, transparent 68%)",
    idleDuration: 8.6,
    hoverScale: 1.24,
    hoverOpacityBoost: 1.18,
  },
  {
    widthMultiplier: 1.76,
    opacity: 0.43,
    rotate: 28,
    scaleX: 0.86,
    scaleY: 1.12,
    background:
      [
        ...NEBULA_CORE_SPARKLES,
        "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.76) 0 9%, transparent 18%)",
        "radial-gradient(ellipse at 49% 44%, rgba(186,230,253,0.88) 0 18%, transparent 42%)",
        "radial-gradient(ellipse at 52% 58%, rgba(240,171,252,0.56) 0 19%, transparent 43%)",
      ].join(","),
    filter: "contrast(1.1) saturate(1.14) brightness(1.03)",
    mask: "radial-gradient(ellipse 44% 58% at 50% 50%, black 33%, rgba(0,0,0,0.88) 53%, transparent 67%)",
    idleDuration: 9.4,
    hoverScale: 1.2,
    hoverOpacityBoost: 1.16,
  },
  {
    widthMultiplier: 1.92,
    opacity: 0.47,
    rotate: -4,
    scaleX: 1,
    scaleY: 1,
    background:
      [
        ...NEBULA_CORE_SPARKLES,
        "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.82) 0 10%, transparent 19%)",
        "radial-gradient(ellipse at 48% 48%, rgba(244,114,182,0.78) 0 21%, transparent 44%)",
        "radial-gradient(ellipse at 54% 55%, rgba(125,211,252,0.42) 0 18%, transparent 38%)",
      ].join(","),
    filter: "contrast(1.14) saturate(1.18) brightness(1.05)",
    mask: "radial-gradient(circle at 50% 50%, black 33%, rgba(0,0,0,0.9) 53%, transparent 67%)",
    idleDuration: 8.9,
    hoverScale: 1.3,
    hoverOpacityBoost: 1.22,
  },
  {
    widthMultiplier: 2.24,
    opacity: 0.42,
    rotate: 12,
    scaleX: 1.36,
    scaleY: 0.68,
    background:
      [
        ...NEBULA_CORE_SPARKLES,
        "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.72) 0 8%, transparent 17%)",
        "radial-gradient(ellipse at 44% 51%, rgba(129,140,248,0.56) 0 19%, transparent 42%)",
        "radial-gradient(ellipse at 58% 50%, rgba(244,114,182,0.74) 0 21%, transparent 45%)",
      ].join(","),
    filter: "contrast(1.12) saturate(1.14) brightness(1.03)",
    mask: "radial-gradient(ellipse 60% 34% at 50% 50%, black 32%, rgba(0,0,0,0.88) 52%, transparent 66%)",
    idleDuration: 10.1,
    hoverScale: 1.22,
    hoverOpacityBoost: 1.15,
  },
  {
    widthMultiplier: 1.9,
    opacity: 0.41,
    rotate: -32,
    scaleX: 1.04,
    scaleY: 0.88,
    background:
      [
        ...NEBULA_CORE_SPARKLES,
        "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.7) 0 8%, transparent 17%)",
        "radial-gradient(ellipse at 46% 51%, rgba(186,230,253,0.66) 0 18%, transparent 41%)",
        "radial-gradient(ellipse at 56% 48%, rgba(251,146,60,0.42) 0 16%, transparent 36%)",
      ].join(","),
    filter: "contrast(1.1) saturate(1.12) brightness(1.03)",
    mask: "radial-gradient(ellipse 50% 44% at 50% 50%, black 32%, rgba(0,0,0,0.88) 52%, transparent 66%)",
    idleDuration: 9.8,
    hoverScale: 1.2,
    hoverOpacityBoost: 1.14,
  },
] as const;

export const NEBULA_HOVER_TRANSITION = {
  type: "spring",
  stiffness: 126,
  damping: 21,
  mass: 0.88,
} as const;

export const NEBULA_IDLE_TRANSITION = {
  type: "spring",
  stiffness: 92,
  damping: 24,
  mass: 1,
} as const;

const SHOOTING_STARS: readonly ShootingStar[] = [
  {
    id: "meteor-1",
    top: 10,
    left: 112,
    width: 12.6,
    angle: -24,
    travelX: -72,
    travelY: 30,
    delay: 1.8,
    duration: 1.22,
    repeatDelay: 14,
  },
  {
    id: "meteor-2",
    top: 27,
    left: 106,
    width: 9.8,
    angle: -21,
    travelX: -58,
    travelY: 22,
    delay: 7.6,
    duration: 1.02,
    repeatDelay: 18,
  },
  {
    id: "meteor-3",
    top: 47,
    left: 118,
    width: 11.8,
    angle: -27,
    travelX: -78,
    travelY: 38,
    delay: 12.4,
    duration: 1.34,
    repeatDelay: 20,
  },
  {
    id: "meteor-4",
    top: 6,
    left: 96,
    width: 7.4,
    angle: -18,
    travelX: -50,
    travelY: 15,
    delay: 17.2,
    duration: 0.92,
    repeatDelay: 22,
  },
] as const;

const NEBULA_FOCUS_MOTION: NebulaFocusMotion = {
  warpScaleStart: 0.2,
  warpScaleMid: 3.9,
  warpScaleEnd: 8.8,
  ringScaleStart: 0.15,
  ringScaleMid: 5.8,
  ringScaleEnd: 10.6,
  warpPeakOpacity: 0.94,
  ringPeakOpacity: 0.98,
};

export function buildNebulaTextureVariants(): NebulaTextureVariant[] {
  return TEXTURE_VARIANTS.map((variant) => ({ ...variant }));
}

export function buildShootingStars(): ShootingStar[] {
  return SHOOTING_STARS.map((star) => ({ ...star }));
}

export function buildNebulaFocusMotion(): NebulaFocusMotion {
  return { ...NEBULA_FOCUS_MOTION };
}
