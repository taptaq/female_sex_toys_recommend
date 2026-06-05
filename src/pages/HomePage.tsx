import { motion } from "motion/react";
import gsap from "gsap";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import {
  Orbit,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  Boxes,
  LogOut,
  Palette,
  Sparkles,
} from "lucide-react";
import { AuthPanel, type AuthPanelMode } from "../components/AuthPanel.tsx";
import { HomeFeedbackModal } from "../components/HomeFeedbackModal.tsx";
import { canShowMvpEntry, shouldUseFemaleMvp } from "../lib/app-mode.ts";
import {
  APP_THEME_OPTIONS,
  type AppThemeId,
} from "../lib/app-theme.ts";
import { submitHomeFeedback } from "../lib/home-feedback.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";
import { getGsapDuration, shouldRunGsapMotion } from "../lib/gsap-motion.ts";

const HOME_FEEDBACK_ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const HOME_FEEDBACK_MAX_SCREENSHOTS = 3;
const FEMALE_MVP_HOME_PLANETS = [
  {
    id: "privacy",
    label: "隐私星",
    shortLabel: "隐私",
    src: "/assets/luna-planets/privacy.png",
    className: "female-mvp-orbit-planet-privacy",
  },
  {
    id: "comfort",
    label: "舒适星",
    shortLabel: "舒适",
    src: "/assets/luna-planets/comfort.png",
    className: "female-mvp-orbit-planet-comfort",
  },
  {
    id: "beginner",
    label: "新手星",
    shortLabel: "新手",
    src: "/assets/luna-planets/beginner.png",
    className: "female-mvp-orbit-planet-beginner",
  },
  {
    id: "care",
    label: "清洁星",
    shortLabel: "清洁",
    src: "/assets/luna-planets/care.png",
    className: "female-mvp-orbit-planet-care",
  },
] as const;
type FemaleMvpHomePlanetId = (typeof FEMALE_MVP_HOME_PLANETS)[number]["id"];
const FEMALE_MVP_FINAL_PLANET_POSITION: Record<
  FemaleMvpHomePlanetId,
  { left: number; top: number }
> = {
  privacy: { left: 21, top: 38 },
  comfort: { left: 79, top: 33 },
  beginner: { left: 78, top: 63 },
  care: { left: 21, top: 66 },
};
const FEMALE_MVP_ORBIT_PATH = "M230 182 C 64 24, 360 10, 388 76 S 64 206, 82 312 S 388 302, 376 348 S 86 348, 230 182";
const FEMALE_MVP_LAUNCH_EXIT_MS = 680;

const HOME_AUTH_OVERLAY_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type HomeFeedbackScreenshotSelectionPlanInput = {
  currentCount: number;
  reservedCount: number;
  selectedTypes: string[];
};

type HomeFeedbackScreenshotSelectionPlan = {
  acceptedIndexes: number[];
  invalidTypeCount: number;
  overflowCount: number;
  remainingCapacity: number;
  nextReservedCount: number;
  hasInvalidTypeError: boolean;
  hasOverflowError: boolean;
};

type HomeAuthOverlayFocusTrapInput = {
  focusableCount: number;
  currentIndex: number;
  isShiftKey: boolean;
};

export function planHomeFeedbackScreenshotSelection({
  currentCount,
  reservedCount,
  selectedTypes,
}: HomeFeedbackScreenshotSelectionPlanInput): HomeFeedbackScreenshotSelectionPlan {
  const normalizedCurrentCount = Math.max(currentCount, 0);
  const normalizedReservedCount = Math.max(reservedCount, 0);
  const remainingCapacity = Math.max(
    0,
    HOME_FEEDBACK_MAX_SCREENSHOTS - normalizedCurrentCount - normalizedReservedCount,
  );
  const acceptedIndexes: number[] = [];
  let invalidTypeCount = 0;
  let overflowCount = 0;

  selectedTypes.forEach((type, index) => {
    if (!HOME_FEEDBACK_ALLOWED_IMAGE_TYPES.has(type)) {
      invalidTypeCount += 1;
      return;
    }

    if (acceptedIndexes.length < remainingCapacity) {
      acceptedIndexes.push(index);
      return;
    }

    overflowCount += 1;
  });

  return {
    acceptedIndexes,
    invalidTypeCount,
    overflowCount,
    remainingCapacity,
    nextReservedCount: normalizedReservedCount + acceptedIndexes.length,
    hasInvalidTypeError: invalidTypeCount > 0,
    hasOverflowError: overflowCount > 0,
  };
}

export function getHomeAuthOverlayFocusTrapTarget({
  focusableCount,
  currentIndex,
  isShiftKey,
}: HomeAuthOverlayFocusTrapInput): number | null {
  if (focusableCount <= 0) {
    return null;
  }

  if (currentIndex < 0) {
    return isShiftKey ? focusableCount - 1 : 0;
  }

  if (isShiftKey && currentIndex === 0) {
    return focusableCount - 1;
  }

  if (!isShiftKey && currentIndex === focusableCount - 1) {
    return 0;
  }

  return null;
}

export function restoreHomeAuthOverlayFocus(
  target: { focus?: () => void } | null | undefined,
) {
  if (!target || typeof target.focus !== "function") {
    return false;
  }

  target.focus();
  return true;
}

function getHomeAuthOverlayFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(HOME_AUTH_OVERLAY_FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hasAttribute("disabled"));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("截图读取失败，请重试"));
    };
    reader.onerror = () => reject(new Error("截图读取失败，请重试"));
    reader.readAsDataURL(file);
  });
}

function SecondaryEntryButton({
  children,
  hint,
  description,
  tone,
  onClick,
}: {
  children: string;
  hint: string;
  description: string;
  tone: "indigo" | "cyan";
  onClick: () => void;
}) {
  const Icon = tone === "cyan" ? Sparkles : Boxes;
  const toneClass =
    tone === "cyan"
      ? "hover:border-cyan-300/24 hover:bg-cyan-400/[0.07] hover:text-cyan-100"
      : "hover:border-indigo-300/22 hover:bg-indigo-400/[0.06] hover:text-indigo-100";
  const hintClass =
    tone === "cyan"
      ? "border-cyan-300/12 bg-cyan-400/[0.05] text-cyan-100/62"
      : "border-white/7 bg-white/[0.032] text-slate-400/90";

  return (
    <span className="home-secondary-node group inline-flex w-full">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${children}：${description}`}
        className={[
          "inline-flex w-full items-center justify-between gap-2 rounded-full border border-white/7 bg-white/[0.022] px-3 py-1.5 text-left text-slate-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          toneClass,
        ].join(" ")}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03]">
            <Icon className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
          </span>
          <span className="whitespace-nowrap text-[11.5px] font-medium leading-4 tracking-[0.04em] text-slate-100 sm:text-[12px] md:text-[12.5px]">
            {children}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={[
            "shrink-0 rounded-full border px-1.5 py-0 text-[8.5px] leading-4 tracking-[0.04em] sm:px-1.5",
            hintClass,
          ].join(" ")}
        >
          {hint}
        </span>
      </button>
    </span>
  );
}

export function HomeAuthOverlay({
  children,
  onClose,
  onKeyDown,
  dialogRef,
  variant = "default",
}: {
  children: ReactNode;
  onClose: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  dialogRef?: Ref<HTMLDivElement>;
  variant?: "default" | "femaleMvp";
}) {
  const isFemaleMvpVariant = variant === "femaleMvp";

  return (
    <div
      className={
        isFemaleMvpVariant
          ? "female-mvp-auth-overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-950/28 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-8 backdrop-blur-md"
          : "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-xl"
      }
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={isFemaleMvpVariant ? "female-mvp-auth-dialog w-full max-w-md" : "w-full max-w-md"}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-auth-dialog-title"
        tabIndex={-1}
      >
        <h2 id="home-auth-dialog-title" className="sr-only">
          登录或注册
        </h2>
        {children}
      </div>
    </div>
  );
}

function HomeAuthEntry({
  authPanel,
  onOpenProfiles,
  onOpenFavorites,
}: {
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, email: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  onOpenProfiles: () => void;
  onOpenFavorites: () => void;
}) {
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false);
  const authEntryButtonRef = useRef<HTMLButtonElement | null>(null);
  const authDialogRef = useRef<HTMLDivElement | null>(null);
  const wasAuthPanelOpenRef = useRef(false);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isAuthPanelOpen) {
      previouslyFocusedElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      authDialogRef.current?.focus();
    } else if (wasAuthPanelOpenRef.current) {
      const restored = restoreHomeAuthOverlayFocus(previouslyFocusedElementRef.current);
      if (!restored) {
        authEntryButtonRef.current?.focus();
      }
      previouslyFocusedElementRef.current = null;
    }

    wasAuthPanelOpenRef.current = isAuthPanelOpen;
  }, [isAuthPanelOpen]);

  function closeAuthOverlay() {
    setIsAuthPanelOpen(false);
  }

  if (authPanel.userLabel) {
    return (
      <div className="home-auth-entry mt-5 flex w-full flex-col gap-3 rounded-2xl border border-emerald-300/12 bg-emerald-400/[0.045] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium text-emerald-50">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-200/75" />
            已登录，推荐档案可同步
          </p>
          <p className="mt-1 truncate text-[11px] text-emerald-100/55">
            {authPanel.userLabel}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onOpenProfiles}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200/16 bg-cyan-100/8 px-3 py-1.5 text-xs text-cyan-50 transition-colors hover:bg-cyan-100/14"
          >
            匹配档案
          </button>
          <button
            type="button"
            onClick={onOpenFavorites}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-200/16 bg-cyan-100/8 px-3 py-1.5 text-xs text-cyan-50 transition-colors hover:bg-cyan-100/14"
          >
            我的收藏
          </button>
          <button
            type="button"
            onClick={() => void authPanel.onSignOut()}
            disabled={authPanel.isSubmitting}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200/16 bg-emerald-100/8 px-3 py-1.5 text-xs text-emerald-50 transition-colors hover:bg-emerald-100/14 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            退出
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="home-auth-entry mt-5 flex w-full flex-col gap-3 rounded-2xl border border-cyan-300/12 bg-cyan-400/[0.035] px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-cyan-50">
            <KeyRound className="h-3.5 w-3.5 text-cyan-200/70" />
            完成匹配后可加密保存
          </p>
          <p className="mt-1 text-[11px] leading-5 text-cyan-100/48">
            登录后可加密保存推荐档案，支持多端同步，也可随时删除。不影响先体验匹配流程。
          </p>
        </div>
        <button
          ref={authEntryButtonRef}
          type="button"
          onClick={() => setIsAuthPanelOpen(true)}
          className="shrink-0 rounded-full border border-cyan-300/18 bg-cyan-300/9 px-4 py-2 text-xs tracking-wider text-cyan-50 transition-colors hover:border-cyan-200/34 hover:bg-cyan-300/14 sm:w-auto"
        >
          登录 / 注册
        </button>
      </div>

      {isAuthPanelOpen ? (
        <HomeAuthOverlay
          onClose={closeAuthOverlay}
          dialogRef={authDialogRef}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              closeAuthOverlay();
              return;
            }

            if (event.key !== "Tab" || !authDialogRef.current) {
              return;
            }

            const focusableElements = getHomeAuthOverlayFocusableElements(authDialogRef.current);
            const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
            const trapTargetIndex = getHomeAuthOverlayFocusTrapTarget({
              focusableCount: focusableElements.length,
              currentIndex,
              isShiftKey: event.shiftKey,
            });

            if (trapTargetIndex === null) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            focusableElements[trapTargetIndex]?.focus();
            if (!focusableElements[trapTargetIndex]) {
              authDialogRef.current.focus();
            }
          }}
        >
          <div>
            <AuthPanel {...authPanel} surface="modal" />
            <button
              type="button"
              onClick={closeAuthOverlay}
              className="mt-3 w-full rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              暂时不用
            </button>
          </div>
        </HomeAuthOverlay>
      ) : null}
    </>
  );
}

function FemaleMvpAuthEntry({
  authPanel,
  buttonRef,
  onOpenAuthPanel,
}: {
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, email: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  buttonRef: Ref<HTMLButtonElement>;
  onOpenAuthPanel: () => void;
}) {
  const entryLabel = authPanel.userLabel || "登录";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpenAuthPanel}
      className="female-mvp-auth-entry"
      aria-label={authPanel.userLabel ? "打开账户面板" : "登录或注册"}
    >
      {entryLabel}
    </button>
  );
}

function HomeThemeSwitcher({
  themeId,
  onThemeChange,
}: {
  themeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
}) {
  return (
    <div className="home-theme-track mb-6 flex w-full items-center gap-3 text-left sm:mb-7">
      <div className="home-theme-track-label flex shrink-0 items-center gap-2 text-[10px] tracking-[0.22em] text-slate-400">
        <Palette className="h-3.5 w-3.5 text-cyan-200/60" />
        <span>主题</span>
      </div>
      <div className="home-theme-track-list flex min-w-0 flex-1 items-center gap-1.5">
        {APP_THEME_OPTIONS.map((option) => {
          const isActive = option.id === themeId;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isActive}
              aria-label={`切换到${option.label}主题`}
              title={option.label}
              onClick={() => onThemeChange(option.id)}
              className={[
                "home-theme-option min-w-0 flex-1 rounded-full border px-2.5 py-2 text-center text-[11px] font-medium tracking-[0.16em] transition-colors",
                isActive
                  ? "home-theme-option-active border-cyan-300/32 bg-cyan-300/12 text-cyan-50"
                  : "border-white/8 bg-white/[0.025] text-cyan-50/72 hover:border-cyan-300/22 hover:bg-cyan-300/[0.07] hover:text-white",
              ].join(" ")}
            >
              <span className="block truncate">{option.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HomePage({
  pageVariants,
  onStart,
  onBrowseLibrary,
  onOpenKnowledgeNebula,
  onOpenProfiles,
  onOpenFavorites,
  themeId,
  onThemeChange,
  authPanel,
}: {
  pageVariants: any;
  onStart: () => void;
  onBrowseLibrary: () => void;
  onOpenKnowledgeNebula: () => void;
  onOpenProfiles: () => void;
  onOpenFavorites: () => void;
  themeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, email: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
}) {
  const { repeat, shouldAnimate, prefersReducedMotion } = usePagePerformanceState();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<string[]>([]);
  const [feedbackScreenshotPreviews, setFeedbackScreenshotPreviews] = useState<string[]>([]);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(null);
  const [feedbackSubmitSuccess, setFeedbackSubmitSuccess] = useState<string | null>(null);
  const [isFemaleMvpLaunching, setIsFemaleMvpLaunching] = useState(false);
  const feedbackCloseTimeoutRef = useRef<number | null>(null);
  const femaleMvpLaunchTimeoutRef = useRef<number | null>(null);
  const feedbackScreenshotCountRef = useRef(0);
  const feedbackPendingScreenshotReservationsRef = useRef(0);
  const femaleMvpHomeRef = useRef<HTMLElement | null>(null);
  const [isFemaleMvpAuthPanelOpen, setIsFemaleMvpAuthPanelOpen] = useState(false);
  const femaleMvpAuthEntryButtonRef = useRef<HTMLButtonElement | null>(null);
  const femaleMvpAuthDialogRef = useRef<HTMLDivElement | null>(null);
  const wasFemaleMvpAuthPanelOpenRef = useRef(false);
  const femaleMvpPreviouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const shouldHideFemaleMvpCopy =
    shouldUseFemaleMvp() &&
    shouldRunGsapMotion({ shouldAnimate, prefersReducedMotion });

  useEffect(() => {
    return () => {
      if (feedbackCloseTimeoutRef.current !== null) {
        window.clearTimeout(feedbackCloseTimeoutRef.current);
      }
      if (femaleMvpLaunchTimeoutRef.current !== null) {
        window.clearTimeout(femaleMvpLaunchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldUseFemaleMvp()) return;
    if (!femaleMvpHomeRef.current) return;

    const motionState = {
      shouldAnimate,
      prefersReducedMotion,
    };

    if (!shouldRunGsapMotion(motionState)) {
      femaleMvpHomeRef.current
        .querySelectorAll<HTMLElement>(
          [
            ".female-mvp-astronaut-image",
            ".female-mvp-astronaut-shimmer",
            ".female-mvp-astronaut-thruster",
            ".female-mvp-copy-reveal",
            ".female-mvp-nav-reveal",
            ".female-mvp-orbit-planet",
            ".female-mvp-game-lobby-stage",
            ".female-mvp-display-plinth",
            ".female-mvp-lens-ribbon",
            ".female-mvp-holo-grid",
            ".female-mvp-stage-backdrop",
            ".female-mvp-orbit-path",
            ".female-mvp-starmap-scan",
          ].join(", "),
        )
        .forEach((element) => {
          element.dataset.introHidden = "false";
          element.style.opacity = "1";
          element.style.visibility = "visible";
          element.style.transform = element.classList.contains("female-mvp-game-lobby-stage")
            ? "translateY(-0.9rem)"
            : "none";
        });
      return;
    }

    const ctx = gsap.context(() => {
      const idleRepeat = repeat === Infinity ? -1 : repeat;
      const startFemaleMvpIdleMotion = () => {
        gsap.to(".female-mvp-astronaut-image", {
          x: "0.1rem",
          y: "-0.46rem",
          z: 34,
          rotation: 1.6,
          duration: getGsapDuration(3.6, motionState),
          ease: "sine.inOut",
          repeat: idleRepeat,
          yoyo: true,
        });

        gsap.to(".female-mvp-orbit-planet", {
          x: (index) => ["0.1rem", "0.14rem", "-0.16rem", "-0.12rem"][index] ?? "0.1rem",
          y: (index) => ["-0.22rem", "-0.3rem", "-0.24rem", "-0.26rem"][index] ?? "-0.24rem",
          rotation: (index) => [0.8, -0.6, 1.2, -1][index] ?? 0.8,
          duration: (index) => getGsapDuration([3.35, 3.55, 3.45, 3.7][index] ?? 3.45, motionState),
          delay: (index) => [0, 0.18, 0.34, 0.5][index] ?? 0,
          ease: "sine.inOut",
          repeat: idleRepeat,
          yoyo: true,
        });

        gsap.to(".female-mvp-planet-label", {
          y: -2,
          autoAlpha: 0.82,
          duration: getGsapDuration(3.8, motionState),
          ease: "sine.inOut",
          repeat: idleRepeat,
          stagger: getGsapDuration(0.16, motionState),
          yoyo: true,
        });

        gsap.to(".female-mvp-stage-backdrop", {
          scale: 1.012,
          duration: getGsapDuration(5.6, motionState),
          ease: "sine.inOut",
          repeat: idleRepeat,
          yoyo: true,
        });
      };

      const timeline = gsap.timeline({
        defaults: { ease: "sine.out" },
        onComplete: () => {
          femaleMvpHomeRef.current
            ?.querySelectorAll<HTMLElement>(".female-mvp-copy-reveal, .female-mvp-nav-reveal")
            .forEach((element) => {
              element.dataset.introHidden = "false";
            });
          startFemaleMvpIdleMotion();
        },
      });

      // Phase 1: Planets appear at their final positions
      timeline
        .set(".female-mvp-nav-reveal", { autoAlpha: 0, y: -10 })
        .set(".female-mvp-copy-reveal", { autoAlpha: 0, y: 10 })
        .set(".female-mvp-orbit-planet", { autoAlpha: 0, scale: 0.92, xPercent: -50, yPercent: -50 })
        .set(".female-mvp-planet-label", { autoAlpha: 0 })
        .set(".female-mvp-route-spark", { autoAlpha: 0 })
        .set(".female-mvp-stage-backdrop", { autoAlpha: 0, scale: 0.98 })
        .set(".female-mvp-starmap-scan", { autoAlpha: 0, scale: 0.86, rotation: -10 })
        .set(".female-mvp-orbit-path", { autoAlpha: 0, strokeDasharray: 720, strokeDashoffset: 720 })
        .set(".female-mvp-game-lobby-stage", { autoAlpha: 1, y: -14 })
        .set(".female-mvp-display-plinth", { autoAlpha: 0.34 })
        .set(".female-mvp-holo-grid", { autoAlpha: 0 })
        .set(".female-mvp-lens-ribbon", { autoAlpha: 0.18 })
        .set(".female-mvp-mission-node", { autoAlpha: 0, y: 6, scale: 0.98 })
        .set(".female-mvp-cabin-orbit-rail", { scaleX: 0.35, autoAlpha: 0 })
        .set(".female-mvp-astronaut-image", { autoAlpha: 0, scale: 0.9, y: 26, z: 34, rotation: -2.4 })
        .addLabel("orbitScan")
        .to(".female-mvp-stage-backdrop", {
          autoAlpha: 1,
          scale: 1,
          duration: getGsapDuration(0.52, motionState),
        })
        .to(
          ".female-mvp-starmap-scan",
          {
            autoAlpha: 0.9,
            scale: 1.08,
            rotation: 4,
            duration: getGsapDuration(0.7, motionState),
            ease: "sine.inOut",
          },
          "<0.04",
        )
        .to(
          ".female-mvp-orbit-path",
          {
            autoAlpha: 0.22,
            strokeDashoffset: 0,
            duration: getGsapDuration(0.72, motionState),
            ease: "sine.inOut",
          },
          "<0.02",
        )
        .addLabel("planetDiscovery", ">-0.34")
        .to(
          ".female-mvp-orbit-planet",
          {
            autoAlpha: 0.86,
            scale: 1,
            filter: "brightness(1.08) saturate(1.06)",
            stagger: getGsapDuration(0.13, motionState),
            duration: getGsapDuration(0.46, motionState),
            ease: "back.out(1.45)",
          },
          "planetDiscovery",
        )
        .to(
          ".female-mvp-orbit-planet",
          {
            filter: "brightness(1) saturate(1)",
            duration: getGsapDuration(0.42, motionState),
            stagger: getGsapDuration(0.05, motionState),
            ease: "sine.out",
          },
          ">-0.18",
        )
        .to(
          ".female-mvp-starmap-scan",
          {
            autoAlpha: 0,
            scale: 1.18,
            duration: getGsapDuration(0.34, motionState),
            ease: "sine.out",
          },
          ">-0.46",
        )
        .addLabel("lunaArrival", ">-0.3");

      // Phase 2: Astronaut drifts in after the star map wakes up
      timeline
        .to(
          ".female-mvp-astronaut-image",
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            rotation: 0,
            duration: getGsapDuration(0.68, motionState),
            ease: "back.out(1.18)",
          },
          "lunaArrival",
        )
        .addLabel("labelReveal", ">-0.24")
        .to(
          ".female-mvp-planet-label",
          {
            autoAlpha: 0.74,
            y: -2,
            stagger: getGsapDuration(0.09, motionState),
            duration: getGsapDuration(0.4, motionState),
          },
          "labelReveal",
        );

      // Phase 3: CTA and navigation fade in
      timeline
        .to(
          ".female-mvp-nav-reveal",
          {
            autoAlpha: 1,
            y: 0,
            duration: getGsapDuration(0.34, motionState),
          },
          "<0.08",
        )
        .to(
          ".female-mvp-cabin-orbit-rail",
          {
            autoAlpha: 1,
            scaleX: 1,
            duration: getGsapDuration(0.34, motionState),
          },
          "<0.08",
        )
        .to(
          ".female-mvp-copy-reveal",
          {
            autoAlpha: 1,
            y: 0,
            stagger: getGsapDuration(0.08, motionState),
            duration: getGsapDuration(0.42, motionState),
          },
          "<0.08",
        )
        .to(
          ".female-mvp-mission-node",
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            stagger: getGsapDuration(0.06, motionState),
            duration: getGsapDuration(0.36, motionState),
          },
          "-=0.26",
        );
    }, femaleMvpHomeRef);

    return () => ctx.revert();
  }, [prefersReducedMotion, repeat, shouldAnimate]);

  const handleFemaleMvpStart = () => {
    if (isFemaleMvpLaunching) return;

    if (!shouldRunGsapMotion({ shouldAnimate, prefersReducedMotion })) {
      onStart();
      return;
    }

    setIsFemaleMvpLaunching(true);
    femaleMvpLaunchTimeoutRef.current = window.setTimeout(() => {
      onStart();
      femaleMvpLaunchTimeoutRef.current = null;
    }, FEMALE_MVP_LAUNCH_EXIT_MS);
  };

  useEffect(() => {
    if (isFemaleMvpAuthPanelOpen) {
      femaleMvpPreviouslyFocusedElementRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      femaleMvpAuthDialogRef.current?.focus();
    } else if (wasFemaleMvpAuthPanelOpenRef.current) {
      const restored = restoreHomeAuthOverlayFocus(
        femaleMvpPreviouslyFocusedElementRef.current,
      );
      if (!restored) {
        femaleMvpAuthEntryButtonRef.current?.focus();
      }
      femaleMvpPreviouslyFocusedElementRef.current = null;
    }

    wasFemaleMvpAuthPanelOpenRef.current = isFemaleMvpAuthPanelOpen;
  }, [isFemaleMvpAuthPanelOpen]);

  function closeFemaleMvpAuthOverlay() {
    setIsFemaleMvpAuthPanelOpen(false);
  }

  function handleFemaleMvpAuthOverlayKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeFemaleMvpAuthOverlay();
      return;
    }

    if (event.key !== "Tab" || !femaleMvpAuthDialogRef.current) {
      return;
    }

    const focusableElements = getHomeAuthOverlayFocusableElements(
      femaleMvpAuthDialogRef.current,
    );
    const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const trapTargetIndex = getHomeAuthOverlayFocusTrapTarget({
      focusableCount: focusableElements.length,
      currentIndex,
      isShiftKey: event.shiftKey,
    });

    if (trapTargetIndex === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    focusableElements[trapTargetIndex]?.focus();
    if (!focusableElements[trapTargetIndex]) {
      femaleMvpAuthDialogRef.current.focus();
    }
  }

  function clearFeedbackCloseTimeout() {
    if (feedbackCloseTimeoutRef.current !== null) {
      window.clearTimeout(feedbackCloseTimeoutRef.current);
      feedbackCloseTimeoutRef.current = null;
    }
  }

  function openFeedbackModal() {
    clearFeedbackCloseTimeout();
    setFeedbackSubmitError(null);
    setFeedbackSubmitSuccess(null);
    setIsFeedbackModalOpen(true);
  }

  function closeFeedbackModal() {
    clearFeedbackCloseTimeout();
    setIsFeedbackModalOpen(false);
    setFeedbackSubmitError(null);
    setFeedbackSubmitSuccess(null);
  }

  async function handleFeedbackFileSelect(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setFeedbackSubmitError(null);
    setFeedbackSubmitSuccess(null);

    const selectedFiles = Array.from(files);
    const selectionPlan = planHomeFeedbackScreenshotSelection({
      currentCount: feedbackScreenshotCountRef.current,
      reservedCount: feedbackPendingScreenshotReservationsRef.current,
      selectedTypes: selectedFiles.map((file) => file.type),
    });
    const filesToAdd = selectionPlan.acceptedIndexes.map((index) => selectedFiles[index]);
    feedbackPendingScreenshotReservationsRef.current = selectionPlan.nextReservedCount;

    if (filesToAdd.length > 0) {
      try {
        const encodedScreenshots = await Promise.all(
          filesToAdd.map((file) => readFileAsDataUrl(file)),
        );
        setFeedbackScreenshots((current) => {
          const next = current.concat(encodedScreenshots);
          feedbackScreenshotCountRef.current = next.length;
          return next;
        });
        setFeedbackScreenshotPreviews((current) => current.concat(encodedScreenshots));
      } catch (error) {
        setFeedbackSubmitError(
          error instanceof Error ? error.message : "截图读取失败，请重试",
        );
        return;
      } finally {
        feedbackPendingScreenshotReservationsRef.current = Math.max(
          0,
          feedbackPendingScreenshotReservationsRef.current - filesToAdd.length,
        );
      }
    }

    const nextErrors: string[] = [];
    if (selectionPlan.hasInvalidTypeError) {
      nextErrors.push("仅支持上传 PNG、JPEG、WEBP 格式截图");
    }
    if (selectionPlan.hasOverflowError) {
      nextErrors.push("最多上传 3 张截图");
    }

    if (nextErrors.length > 0) {
      setFeedbackSubmitError(nextErrors.join("；"));
    }
  }

  function handleFeedbackScreenshotRemove(index: number) {
    clearFeedbackCloseTimeout();
    setFeedbackSubmitError(null);
    setFeedbackSubmitSuccess(null);
    setFeedbackScreenshots((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      feedbackScreenshotCountRef.current = next.length;
      return next;
    });
    setFeedbackScreenshotPreviews((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function handleFeedbackSubmit() {
    clearFeedbackCloseTimeout();

    const trimmedMessage = feedbackMessage.trim();
    if (!trimmedMessage) {
      setFeedbackSubmitError("请先填写反馈内容");
      setFeedbackSubmitSuccess(null);
      return;
    }

    setIsFeedbackSubmitting(true);
    setFeedbackSubmitError(null);
    setFeedbackSubmitSuccess(null);

    try {
      await submitHomeFeedback({
        message: trimmedMessage,
        screenshots: feedbackScreenshots,
        pageRoute: "/",
      });

      setFeedbackMessage("");
      setFeedbackScreenshots(() => {
        feedbackScreenshotCountRef.current = 0;
        return [];
      });
      setFeedbackScreenshotPreviews([]);
      feedbackPendingScreenshotReservationsRef.current = 0;
      setFeedbackSubmitSuccess("反馈提交成功");
      setFeedbackSubmitError(null);
      feedbackCloseTimeoutRef.current = window.setTimeout(() => {
        setIsFeedbackModalOpen(false);
        setFeedbackSubmitSuccess(null);
        feedbackCloseTimeoutRef.current = null;
      }, 1200);
    } catch (error) {
      setFeedbackSubmitError(
        error instanceof Error ? error.message : "提交反馈失败，请稍后重试",
      );
    } finally {
      setIsFeedbackSubmitting(false);
    }
  }

  if (shouldUseFemaleMvp()) {
    return (
      <>
        <main
          ref={femaleMvpHomeRef}
          className={[
            "female-mvp-home relative isolate flex h-[100dvh] max-h-[100dvh] min-h-[100svh] w-full flex-col overflow-hidden px-4 py-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-slate-800 sm:px-8 sm:py-8",
            shouldAnimate ? "" : "ambient-motion-paused",
            isFemaleMvpLaunching ? "female-mvp-home-launching" : "",
          ].join(" ")}
          aria-busy={isFemaleMvpLaunching}
        >
          <div className="female-mvp-stars" aria-hidden="true" />
          <div
            data-intro-hidden={shouldHideFemaleMvpCopy ? "true" : "false"}
            className="female-mvp-nav-reveal relative z-10 flex items-center justify-between gap-3"
          >
            <span className="female-mvp-brand-mark">
              <span className="female-mvp-brand-mark__signal" aria-hidden="true" />
              <span>
                <strong>Luna</strong>
                <em>女性向私密匹配</em>
              </span>
            </span>
            <FemaleMvpAuthEntry
              authPanel={authPanel}
              buttonRef={femaleMvpAuthEntryButtonRef}
              onOpenAuthPanel={() => setIsFemaleMvpAuthPanelOpen(true)}
            />
          </div>

          <section className="female-mvp-starmap-shell relative z-10 mx-auto grid min-h-0 w-full max-w-[30rem] flex-1 pb-0 pt-3 text-center sm:max-w-[34rem]">
            <div className="female-mvp-intro-stage female-mvp-launch-shell" aria-hidden="true">
              <span className="female-mvp-stage-backdrop" />
              <span className="female-mvp-depth-wash" />
              <div className="female-mvp-game-lobby-stage">
                <span className="female-mvp-holo-grid" />
                <span className="female-mvp-display-plinth" />
                <span className="female-mvp-lens-ribbon" />
                <span className="female-mvp-carousel-aperture" />
                <span className="female-mvp-planet-continuity" />
                <span className="female-mvp-portal-flare" />
                <span className="female-mvp-luna-backdrop" />
                <svg className="female-mvp-orbit-map" viewBox="0 0 460 360" focusable="false">
                  <path
                    className="female-mvp-orbit-path"
                    d={FEMALE_MVP_ORBIT_PATH}
                  />
                </svg>
                <span className="female-mvp-starmap-scan" />
                {FEMALE_MVP_HOME_PLANETS.map((planet) => {
                  const pos = FEMALE_MVP_FINAL_PLANET_POSITION[planet.id];
                  return (
                    <span
                      key={`${planet.id}-spark`}
                      className={[
                        "female-mvp-route-spark",
                        `female-mvp-route-spark-${planet.id}`,
                      ].join(" ")}
                      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                    />
                  );
                })}
                {FEMALE_MVP_HOME_PLANETS.map((planet) => {
                  const pos = FEMALE_MVP_FINAL_PLANET_POSITION[planet.id];
                  return (
                    <span
                      key={`${planet.id}-label`}
                      className={[
                        "female-mvp-planet-label",
                        `female-mvp-planet-label-${planet.id}`,
                      ].join(" ")}
                      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                    >
                      {planet.shortLabel}
                    </span>
                  );
                })}
                {FEMALE_MVP_HOME_PLANETS.map((planet) => {
                  const pos = FEMALE_MVP_FINAL_PLANET_POSITION[planet.id];
                  return (
                    <span
                      key={planet.id}
                      aria-label={planet.label}
                      className={[
                        "female-mvp-orbit-planet",
                        planet.className,
                      ].join(" ")}
                      style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                    >
                      <img
                        src={planet.src}
                        alt=""
                        className="female-mvp-orbit-planet-image"
                      />
                    </span>
                  );
                })}
                <div className="female-mvp-astronaut">
                  <span className="female-mvp-astronaut-thruster" aria-hidden="true" />
                  <span className="female-mvp-astronaut-shimmer" aria-hidden="true" />
                  <img
                    src="/assets/luna-astronaut/yeah.png"
                    alt="Luna 小宇航员"
                    className="female-mvp-astronaut-image"
                  />
                </div>
              </div>
            </div>

            <div
              data-intro-hidden={shouldHideFemaleMvpCopy ? "true" : "false"}
              className="female-mvp-copy-reveal female-mvp-mission-card female-mvp-equipment-cabin"
            >
              <span className="female-mvp-cabin-orbit-rail" aria-hidden="true" />
              <p className="female-mvp-briefing-line">
                <span>女性向 · 私密匹配</span>
              </p>
              <h1 className="mt-3 text-[1.9rem] font-black leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">
                找到适合你的装备
              </h1>
              <p className="female-mvp-copy-line mx-auto mt-4 max-w-[20rem] text-[13px] leading-7 text-slate-600 sm:max-w-md sm:text-base">
                <span>按感受、场景和偏好</span>
                <span>问答、直说、筛选，或抽一份小幸运</span>
              </p>

              <div className="female-mvp-mode-dock female-mvp-mission-nodes mt-5">
                {[
                  "问答",
                  "直说",
                  "筛选",
                  "幸运",
                ].map((mode) => (
                  <span
                    key={mode}
                    className="female-mvp-mission-node"
                  >
                    {mode}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleFemaleMvpStart}
              disabled={isFemaleMvpLaunching}
              data-intro-hidden={shouldHideFemaleMvpCopy ? "true" : "false"}
              className="female-mvp-copy-reveal female-mvp-primary-button mt-2 inline-flex w-full items-center justify-center rounded-[1.35rem] px-5 py-3.5 text-base font-black tracking-[0.1em] text-white shadow-[0_18px_42px_rgba(244,114,182,0.34)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200/90 sm:max-w-[20rem]"
            >
              让 Luna 帮我看看
            </button>
            <p
              data-intro-hidden={shouldHideFemaleMvpCopy ? "true" : "false"}
              className="female-mvp-copy-reveal female-mvp-trust-strip"
            >
              隐私友好 · 本地体验
            </p>
          </section>
        </main>

        <HomeFeedbackModal
          isOpen={isFeedbackModalOpen}
          message={feedbackMessage}
          screenshotPreviews={feedbackScreenshotPreviews}
          isSubmitting={isFeedbackSubmitting}
          submitError={feedbackSubmitError}
          submitSuccess={feedbackSubmitSuccess}
          onMessageChange={(message) => {
            clearFeedbackCloseTimeout();
            setFeedbackMessage(message);
            setFeedbackSubmitError(null);
            setFeedbackSubmitSuccess(null);
          }}
          onFileSelect={handleFeedbackFileSelect}
          onRemoveScreenshot={handleFeedbackScreenshotRemove}
          onClose={closeFeedbackModal}
          onSubmit={handleFeedbackSubmit}
        />

        {isFemaleMvpAuthPanelOpen ? (
          <HomeAuthOverlay
            variant="femaleMvp"
            onClose={closeFemaleMvpAuthOverlay}
            dialogRef={femaleMvpAuthDialogRef}
            onKeyDown={handleFemaleMvpAuthOverlayKeyDown}
          >
            <div className="female-mvp-auth-modal-shell">
              <span className="female-mvp-auth-orbit-glow" aria-hidden="true" />
              <div className="female-mvp-auth-modal-header">
                <span> Luna 私密舱 </span>
                <p>{authPanel.userLabel ? "同步你的探索记录" : "登录后再保存也不迟"}</p>
              </div>
              <AuthPanel {...authPanel} surface="modal" />
              {authPanel.userLabel ? (
                <div className="female-mvp-auth-modal-actions">
                  <button type="button" onClick={onOpenProfiles}>
                    匹配档案
                  </button>
                  <button type="button" onClick={onOpenFavorites}>
                    我的收藏
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={closeFemaleMvpAuthOverlay}
                className="female-mvp-auth-modal-close"
              >
                暂时不用
              </button>
            </div>
          </HomeAuthOverlay>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div
        className={[
          "relative w-full flex flex-col items-center px-1 py-2",
          shouldAnimate ? "" : "ambient-motion-paused",
        ].join(" ")}
      >
        <motion.div
          key="welcome"
          variants={pageVariants}
          initial={false}
          animate="in"
          exit="out"
          className="relative z-10 flex w-full flex-col items-center"
        >
          <div className="relative mb-9 flex items-center justify-center sm:mb-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: shouldAnimate ? 20 : 0.2, repeat, ease: "linear" }}
              className="absolute h-28 w-28 rounded-full border border-cyan-500/20 sm:h-32 sm:w-32"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: shouldAnimate ? 30 : 0.2, repeat, ease: "linear" }}
              className="absolute h-36 w-36 rounded-full border border-indigo-500/20 border-dashed sm:h-40 sm:w-40"
            />
            <motion.span
              className="absolute h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(125,211,252,0.85)]"
              animate={{ rotate: 360 }}
              transition={{ duration: shouldAnimate ? 7 : 0.2, repeat, ease: "linear" }}
              style={{ transformOrigin: "4.25rem 0.25rem" }}
            />
            <div className="home-orbit-core relative z-10 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full glass-panel shadow-[0_0_48px_rgba(34,211,238,0.16)] sm:h-20 sm:w-20">
              <div className="absolute inset-2 rounded-full bg-cyan-300/6 blur-md" />
              <Orbit className="relative w-10 h-10 text-cyan-300 opacity-90" />
            </div>
          </div>

          <div className="glass-panel relative flex w-full flex-col items-center overflow-hidden rounded-[1.75rem] p-6 text-center shadow-[0_24px_90px_rgba(2,8,23,0.42)] sm:rounded-3xl sm:p-8">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-50"></div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(115deg,transparent,rgba(255,255,255,0.035),transparent_42%)]" />

            <h1 className="relative mb-2 text-2xl font-light tracking-[0.22em] text-white sm:text-3xl sm:tracking-widest">
              内太空装备智能选品向导
            </h1>
            <h2 className="relative mb-7 font-mono text-[11px] tracking-[0.28em] text-cyan-500/80 sm:mb-8 sm:text-xs sm:tracking-widest">
              SELECTION GUIDE
            </h2>

            <p className="relative mb-8 max-w-[19rem] text-sm leading-7 text-slate-300 sm:mb-10 sm:max-w-[300px]">
              跳过复杂难懂的参数陷阱与营销词汇。只需回答几个简单的偏好问题，我们将基于过滤体系，为你精准匹配出最契合自身需求的私密设备。
            </p>

            <HomeThemeSwitcher
              themeId={themeId}
              onThemeChange={onThemeChange}
            />

            <button
              onClick={onStart}
              className="home-primary-ignition group relative w-full py-4 rounded-2xl bg-cyan-500/18 hover:bg-cyan-400/24 border border-cyan-300/40 text-cyan-50 transition-all overflow-hidden flex items-center justify-center gap-2 shadow-[0_0_36px_rgba(34,211,238,0.16)]"
            >
              <span className="absolute inset-0 bg-cyan-400/5" />
              <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-[340%]" />
              <span className="absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-100/55 to-transparent opacity-70" />
              <span className="relative z-10 flex items-center gap-2 tracking-widest text-sm font-medium">
                开始匹配
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <div className="mt-5 w-full border-t border-white/8 pt-5">
              <p className="text-[10px] tracking-[0.16em] text-slate-500">
                还没准备开始，也可以先快速看看
              </p>
            </div>

            <div className="mt-2.5 grid w-full gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              <SecondaryEntryButton
                onClick={onBrowseLibrary}
                hint="同类比较"
                tone="indigo"
                description="拿到推荐方向后，再回来横向比较同类和价位。"
              >
                装备库
              </SecondaryEntryButton>

              <SecondaryEntryButton
                onClick={onOpenKnowledgeNebula}
                hint="参数避坑"
                tone="cyan"
                description="先补参数解读、常见误区和新手避坑。"
              >
                知识星云
              </SecondaryEntryButton>

              <SecondaryEntryButton
                onClick={openFeedbackModal}
                hint="体验反馈"
                tone="indigo"
                description="反馈体验问题、文案疑惑或你想补上的能力。"
              >
                意见反馈
              </SecondaryEntryButton>
            </div>

            <HomeAuthEntry
              authPanel={authPanel}
              onOpenProfiles={onOpenProfiles}
              onOpenFavorites={onOpenFavorites}
            />
          </div>
        </motion.div>
      </div>

      <HomeFeedbackModal
        isOpen={isFeedbackModalOpen}
        message={feedbackMessage}
        screenshotPreviews={feedbackScreenshotPreviews}
        isSubmitting={isFeedbackSubmitting}
        submitError={feedbackSubmitError}
        submitSuccess={feedbackSubmitSuccess}
        onMessageChange={(message) => {
          clearFeedbackCloseTimeout();
          setFeedbackMessage(message);
          setFeedbackSubmitError(null);
          setFeedbackSubmitSuccess(null);
        }}
        onFileSelect={handleFeedbackFileSelect}
        onRemoveScreenshot={handleFeedbackScreenshotRemove}
        onClose={closeFeedbackModal}
        onSubmit={handleFeedbackSubmit}
      />
    </>
  );
}
