import { motion } from "motion/react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
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
import {
  APP_THEME_HOME_COSMOS_IMAGE_BY_ID,
  APP_THEME_OPTIONS,
  type AppThemeId,
} from "../lib/app-theme.ts";
import { submitHomeFeedback } from "../lib/home-feedback.ts";
import { usePagePerformanceState } from "../lib/page-performance.ts";

const HOME_FEEDBACK_ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const HOME_FEEDBACK_MAX_SCREENSHOTS = 3;
const HOME_SPACE_PHOTO_CROSSFADE_MS = 900;
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

type HomeSpacePhotoLayerState = "entering" | "active" | "exiting";

type HomeSpacePhotoLayer = {
  themeId: AppThemeId;
  state: HomeSpacePhotoLayerState;
};

const HOME_SPACE_PHOTO_LAYER_OPACITY_BY_THEME: Record<AppThemeId, number> = {
  "inner-space": 0.34,
  "soft-signal": 0.32,
  "vector-pulse": 0.3,
  "sync-field": 0.3,
};

const HOME_SPACE_PHOTO_LAYER_CLASS_BY_THEME: Record<AppThemeId, string> = {
  "inner-space": "home-space-photo-image-inner-space",
  "soft-signal": "home-space-photo-image-soft-signal",
  "vector-pulse": "home-space-photo-image-vector-pulse",
  "sync-field": "home-space-photo-image-sync-field",
};

const useHomePhotoTransitionEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  tooltip,
  tone,
  onClick,
}: {
  children: string;
  tooltip: string;
  tone: "indigo" | "cyan";
  onClick: () => void;
}) {
  const Icon = tone === "cyan" ? Sparkles : Boxes;
  const toneClass =
    tone === "cyan"
      ? "hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
      : "hover:border-indigo-300/30 hover:bg-indigo-400/10 hover:text-indigo-100";

  return (
    <span className="home-secondary-node group relative inline-flex w-full sm:w-auto">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${children}：${tooltip}`}
        className={[
          "relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/8 bg-white/[0.035] px-4 py-2 text-xs tracking-wider text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/55 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 group-hover:-translate-y-0.5 sm:w-auto",
          toneClass,
        ].join(" ")}
      >
        <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/8 to-transparent transition-transform duration-500 group-hover:translate-x-[120%]" />
        <Icon className="relative h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
        <span className="relative">{children}</span>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 w-[13.5rem] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-950/92 px-3 py-2 text-center text-[11px] leading-5 text-slate-300 opacity-0 shadow-[0_0_34px_rgba(14,165,233,0.14)] backdrop-blur-xl transition-all duration-150 group-focus-within:-translate-y-1 group-focus-within:opacity-100 group-hover:-translate-y-1 group-hover:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}

function HomeSpacePhotoLayer({
  layer,
}: {
  layer: HomeSpacePhotoLayer;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      src={APP_THEME_HOME_COSMOS_IMAGE_BY_ID[layer.themeId]}
      className={[
        "home-space-photo-image",
        HOME_SPACE_PHOTO_LAYER_CLASS_BY_THEME[layer.themeId],
        `home-space-photo-image-${layer.state}`,
      ].join(" ")}
      style={
        {
          "--home-space-photo-layer-opacity":
            HOME_SPACE_PHOTO_LAYER_OPACITY_BY_THEME[layer.themeId],
        } as CSSProperties
      }
    />
  );
}

export function HomeAuthOverlay({
  children,
  onClose,
  onKeyDown,
  dialogRef,
}: {
  children: ReactNode;
  onClose: () => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  dialogRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-xl"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md"
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
}: {
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
  onOpenProfiles: () => void;
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
                  : "border-white/8 bg-white/[0.025] text-slate-300 hover:border-cyan-300/22 hover:bg-cyan-300/[0.07] hover:text-white",
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
  themeId,
  onThemeChange,
  authPanel,
}: {
  pageVariants: any;
  onStart: () => void;
  onBrowseLibrary: () => void;
  onOpenKnowledgeNebula: () => void;
  onOpenProfiles: () => void;
  themeId: AppThemeId;
  onThemeChange: (themeId: AppThemeId) => void;
  authPanel: {
    isConfigured: boolean;
    userLabel: string | null;
    statusMessage: string | null;
    isSubmitting: boolean;
    onSubmit: (mode: AuthPanelMode, username: string, password: string) => Promise<void>;
    onSignOut: () => Promise<void>;
  };
}) {
  const { repeat, shouldAnimate } = usePagePerformanceState();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackScreenshots, setFeedbackScreenshots] = useState<string[]>([]);
  const [feedbackScreenshotPreviews, setFeedbackScreenshotPreviews] = useState<string[]>([]);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<string | null>(null);
  const [feedbackSubmitSuccess, setFeedbackSubmitSuccess] = useState<string | null>(null);
  const [photoLayers, setPhotoLayers] = useState<HomeSpacePhotoLayer[]>([
    { themeId, state: "active" },
  ]);
  const feedbackCloseTimeoutRef = useRef<number | null>(null);
  const feedbackScreenshotCountRef = useRef(0);
  const feedbackPendingScreenshotReservationsRef = useRef(0);
  const previousPhotoThemeIdRef = useRef(themeId);
  const photoTransitionFrameRef = useRef<number | null>(null);
  const photoTransitionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackCloseTimeoutRef.current !== null) {
        window.clearTimeout(feedbackCloseTimeoutRef.current);
      }
      if (photoTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(photoTransitionFrameRef.current);
      }
      if (photoTransitionTimeoutRef.current !== null) {
        window.clearTimeout(photoTransitionTimeoutRef.current);
      }
    };
  }, []);

  useHomePhotoTransitionEffect(() => {
    const previousThemeId = previousPhotoThemeIdRef.current;
    if (previousThemeId === themeId) {
      return;
    }

    previousPhotoThemeIdRef.current = themeId;

    if (photoTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(photoTransitionFrameRef.current);
      photoTransitionFrameRef.current = null;
    }
    if (photoTransitionTimeoutRef.current !== null) {
      window.clearTimeout(photoTransitionTimeoutRef.current);
      photoTransitionTimeoutRef.current = null;
    }

    setPhotoLayers([
      { themeId: previousThemeId, state: "exiting" },
      { themeId, state: "entering" },
    ]);

    photoTransitionFrameRef.current = window.requestAnimationFrame(() => {
      setPhotoLayers((currentLayers) =>
        currentLayers.map((layer) =>
          layer.themeId === themeId ? { ...layer, state: "active" } : layer,
        ),
      );
      photoTransitionFrameRef.current = null;
    });

    photoTransitionTimeoutRef.current = window.setTimeout(() => {
      setPhotoLayers([{ themeId, state: "active" }]);
      photoTransitionTimeoutRef.current = null;
    }, HOME_SPACE_PHOTO_CROSSFADE_MS + 120);
  }, [themeId]);

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

  return (
    <>
      <div
        className={[
          "relative w-full flex flex-col items-center px-1 py-2",
          shouldAnimate ? "" : "ambient-motion-paused",
        ].join(" ")}
      >
        <div className="home-space-depth pointer-events-none absolute left-1/2 top-[-20%] -z-10 h-[134%] w-[112vw] -translate-x-1/2 overflow-hidden">
          <div className="home-space-photo">
            {photoLayers.map((layer) => (
              <HomeSpacePhotoLayer
                key={layer.themeId}
                layer={layer}
              />
            ))}
          </div>
          <div className="home-space-photo-veil" />
          <div className="home-space-nebula-flow home-space-nebula-flow-a absolute inset-0" />
          <div className="home-space-nebula-flow home-space-nebula-flow-b absolute inset-0" />
          <div className="home-space-galaxy-disk absolute inset-0" />
          <div className="home-space-galaxy-stream absolute inset-0" />
          <div className="home-space-aurora absolute inset-0" />
          <div className="home-space-stars home-space-stars-a absolute inset-0" />
          <div className="home-space-stars home-space-stars-b absolute inset-0" />
          <div className="home-space-orbit home-space-orbit-a absolute left-[42%] top-[18%] h-[34rem] w-[64rem] -translate-x-1/2 rounded-[50%] border border-cyan-100/8" />
          <div className="home-space-orbit home-space-orbit-b home-space-orbit-offset absolute left-[38%] top-[25%] h-[27rem] w-[54rem] -translate-x-1/2 rounded-[50%] border border-indigo-100/7" />
        </div>

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

            <div className="mt-5 flex w-full flex-col items-center gap-2 border-t border-white/8 pt-5 sm:flex-row sm:justify-center sm:gap-4">
              <SecondaryEntryButton
                onClick={onBrowseLibrary}
                tone="indigo"
                tooltip="先看真实装备参数、价格区间和筛选维度，建立大概参考。"
              >
                先随便看看装备库
              </SecondaryEntryButton>

              <SecondaryEntryButton
                onClick={onOpenKnowledgeNebula}
                tone="cyan"
                tooltip="了解常见误区、参数怎么读，以及新手选择时该避开的坑。"
              >
                看看知识星云
              </SecondaryEntryButton>

              <SecondaryEntryButton
                onClick={openFeedbackModal}
                tone="indigo"
                tooltip="反馈首页体验问题、文案疑惑，或告诉我们你希望补上的能力。"
              >
                意见反馈
              </SecondaryEntryButton>
            </div>

            <HomeAuthEntry authPanel={authPanel} onOpenProfiles={onOpenProfiles} />
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
