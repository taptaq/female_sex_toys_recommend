export type HumanDelayRange = {
  minMs: number;
  maxMs: number;
};

export function getHumanDelayMs(
  range: HumanDelayRange,
  random: () => number = Math.random,
): number {
  const minMs = Math.max(0, Math.floor(range.minMs));
  const maxMs = Math.max(minMs, Math.floor(range.maxMs));
  const ratio = Math.min(1, Math.max(0, random()));
  return Math.round(minMs + (maxMs - minMs) * ratio);
}
