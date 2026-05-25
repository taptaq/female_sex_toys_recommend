export type GsapMotionState = {
  shouldAnimate: boolean;
  prefersReducedMotion: boolean;
};

export function shouldRunGsapMotion(state: GsapMotionState): boolean {
  return state.shouldAnimate && !state.prefersReducedMotion;
}

export function getGsapDuration(duration: number, state: GsapMotionState): number {
  return shouldRunGsapMotion(state) ? duration : 0;
}
