import { useSyncExternalStore } from "react";

export type AmbientAnimationMode = "full" | "reduced" | "paused";

export function getAmbientAnimationMode({
  isVisible,
  prefersReducedMotion,
}: {
  isVisible: boolean;
  prefersReducedMotion: boolean;
}): AmbientAnimationMode {
  if (!isVisible) {
    return "paused";
  }

  return prefersReducedMotion ? "reduced" : "full";
}

export function getAmbientAnimationRepeat(mode: AmbientAnimationMode) {
  return mode === "full" ? Infinity : 0;
}

export function shouldRunAmbientAnimation(mode: AmbientAnimationMode) {
  return mode === "full";
}

function getInitialReducedMotionPreference() {
  if (typeof window === "undefined" || !("matchMedia" in window)) {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getInitialPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return !document.hidden;
}

type PagePerformanceSnapshot = {
  isVisible: boolean;
  prefersReducedMotion: boolean;
};

const listeners = new Set<() => void>();
let snapshot: PagePerformanceSnapshot = {
  isVisible: getInitialPageVisibility(),
  prefersReducedMotion: getInitialReducedMotionPreference(),
};
let cleanupStore: (() => void) | null = null;

function readSnapshot(): PagePerformanceSnapshot {
  return {
    isVisible: getInitialPageVisibility(),
    prefersReducedMotion: getInitialReducedMotionPreference(),
  };
}

function notify() {
  const nextSnapshot = readSnapshot();
  if (
    nextSnapshot.isVisible === snapshot.isVisible &&
    nextSnapshot.prefersReducedMotion === snapshot.prefersReducedMotion
  ) {
    return;
  }

  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener());
}

function attachStore() {
  if (cleanupStore || typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const sync = () => notify();
  const mediaQuery =
    "matchMedia" in window
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;

  document.addEventListener("visibilitychange", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("blur", sync);
  mediaQuery?.addEventListener("change", sync);

  snapshot = readSnapshot();

  cleanupStore = () => {
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("focus", sync);
    window.removeEventListener("blur", sync);
    mediaQuery?.removeEventListener("change", sync);
    cleanupStore = null;
  };
}

function subscribeToPagePerformance(listener: () => void) {
  listeners.add(listener);
  attachStore();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && cleanupStore) {
      cleanupStore();
    }
  };
}

function getSnapshot() {
  return snapshot;
}

export function usePageVisibility() {
  return useSyncExternalStore(
    subscribeToPagePerformance,
    () => getSnapshot().isVisible,
    () => getInitialPageVisibility(),
  );
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToPagePerformance,
    () => getSnapshot().prefersReducedMotion,
    () => getInitialReducedMotionPreference(),
  );
}

export function usePagePerformanceState() {
  const currentSnapshot = useSyncExternalStore(
    subscribeToPagePerformance,
    getSnapshot,
    () => ({
      isVisible: getInitialPageVisibility(),
      prefersReducedMotion: getInitialReducedMotionPreference(),
    }),
  );
  const animationMode = getAmbientAnimationMode({
    isVisible: currentSnapshot.isVisible,
    prefersReducedMotion: currentSnapshot.prefersReducedMotion,
  });

  return {
    animationMode,
    isVisible: currentSnapshot.isVisible,
    prefersReducedMotion: currentSnapshot.prefersReducedMotion,
    repeat: getAmbientAnimationRepeat(animationMode),
    shouldAnimate: shouldRunAmbientAnimation(animationMode),
  };
}
