import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";

type HomeFeedbackModalProps = {
  isOpen: boolean;
  message: string;
  screenshotPreviews: string[];
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: string | null;
  onMessageChange: (message: string) => void;
  onFileSelect: (files: FileList | null) => void;
  onRemoveScreenshot: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
};

type HomeFeedbackModalViewProps = HomeFeedbackModalProps & {
  dialogRef?: RefObject<HTMLDivElement | null>;
  messageFieldRef?: RefObject<HTMLTextAreaElement | null>;
  onDialogKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

type HomeFeedbackFocusTrapInput = {
  focusableCount: number;
  currentIndex: number;
  isShiftKey: boolean;
};

type HomeFeedbackFocusableTarget = {
  focus?: () => void;
} | null | undefined;

type HomeFeedbackFocusSessionInput = {
  activeElement: HomeFeedbackFocusableTarget;
  isSubmitting: boolean;
  dialog: HomeFeedbackFocusableTarget;
  messageField: HomeFeedbackFocusableTarget;
};

const HOME_FEEDBACK_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function getHomeFeedbackFocusTrapTarget({
  focusableCount,
  currentIndex,
  isShiftKey,
}: HomeFeedbackFocusTrapInput): number | null {
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

export function restoreHomeFeedbackFocus(
  target: { focus?: () => void } | null | undefined,
) {
  if (!target || typeof target.focus !== "function") {
    return false;
  }

  target.focus();
  return true;
}

export function focusHomeFeedbackActiveTarget({
  isSubmitting,
  dialog,
  messageField,
}: {
  isSubmitting: boolean;
  dialog: HomeFeedbackFocusableTarget;
  messageField: HomeFeedbackFocusableTarget;
}) {
  const target = !isSubmitting ? messageField ?? dialog : dialog;
  return restoreHomeFeedbackFocus(target);
}

export function beginHomeFeedbackFocusSession({
  activeElement,
  isSubmitting,
  dialog,
  messageField,
}: HomeFeedbackFocusSessionInput) {
  const previousFocusTarget = activeElement;
  focusHomeFeedbackActiveTarget({
    isSubmitting,
    dialog,
    messageField,
  });

  return () => {
    restoreHomeFeedbackFocus(previousFocusTarget);
  };
}

function getHomeFeedbackFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(HOME_FEEDBACK_FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hasAttribute("disabled"));
}

export function HomeFeedbackModalView({
  isOpen,
  message,
  screenshotPreviews,
  isSubmitting,
  submitError,
  submitSuccess,
  onMessageChange,
  onFileSelect,
  onRemoveScreenshot,
  onClose,
  onSubmit,
  dialogRef,
  messageFieldRef,
  onDialogKeyDown,
}: HomeFeedbackModalViewProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-xl"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-[1.7rem] border border-cyan-300/18 bg-slate-950 p-5 text-left shadow-[0_0_90px_rgba(8,47,73,0.38)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-feedback-modal-title"
        tabIndex={-1}
      >
        <div className="mb-4">
          <h2
            id="home-feedback-modal-title"
            className="text-lg font-medium tracking-[0.16em] text-white"
          >
            意见反馈
          </h2>
          <p className="mt-1 text-xs leading-5 text-cyan-100/55">
            告诉我们哪里不顺手、哪里还可以更清楚，后续会继续补齐提交流程。
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="block text-sm font-medium text-cyan-50" htmlFor="home-feedback-message">
            反馈内容
          </label>
          <textarea
            ref={messageFieldRef}
            id="home-feedback-message"
            required
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            disabled={isSubmitting}
            rows={5}
            placeholder="欢迎告诉我们你想吐槽、补充或期待的内容"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-55"
          />

          <div className="mt-4">
            <label
              className="block text-sm font-medium text-cyan-50"
              htmlFor="home-feedback-screenshots"
            >
              截图上传（可选，最多 3 张）
            </label>
            <input
              id="home-feedback-screenshots"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isSubmitting}
              onChange={(event) => {
                onFileSelect(event.target.files);
                event.currentTarget.value = "";
              }}
              className="mt-2 block w-full rounded-xl border border-dashed border-white/12 bg-white/[0.025] px-3 py-3 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-300/12 file:px-3 file:py-1.5 file:text-xs file:text-cyan-50 disabled:cursor-not-allowed disabled:opacity-55"
            />

            <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
              {screenshotPreviews.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {screenshotPreviews.map((preview, index) => (
                    <div
                      key={`${preview}-${index}`}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80"
                    >
                      <img
                        src={preview}
                        alt={`反馈截图预览 ${index + 1}`}
                        className="h-28 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => onRemoveScreenshot(index)}
                        disabled={isSubmitting}
                        className="w-full border-t border-white/10 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        移除截图
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-5 text-slate-400">预览区域会显示已选截图。</p>
              )}
            </div>
          </div>

          {submitError ? (
            <p className="mt-3 text-xs leading-5 text-rose-200/85">{submitError}</p>
          ) : null}
          {submitSuccess ? (
            <p className="mt-3 text-xs leading-5 text-emerald-200/85">{submitSuccess}</p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-4 py-2 text-xs font-medium tracking-wider text-cyan-50 transition-colors hover:border-cyan-200/45 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isSubmitting ? "提交中..." : "提交反馈"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              暂不反馈
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function HomeFeedbackModal({
  isOpen,
  message,
  screenshotPreviews,
  isSubmitting,
  submitError,
  submitSuccess,
  onMessageChange,
  onFileSelect,
  onRemoveScreenshot,
  onClose,
  onSubmit,
}: HomeFeedbackModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const messageFieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    return beginHomeFeedbackFocusSession({
      activeElement:
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      isSubmitting,
      dialog: dialogRef.current,
      messageField: messageFieldRef.current,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    focusHomeFeedbackActiveTarget({
      isSubmitting,
      dialog: dialogRef.current,
      messageField: messageFieldRef.current,
    });
  }, [isOpen, isSubmitting]);

  return (
    <HomeFeedbackModalView
      isOpen={isOpen}
      message={message}
      screenshotPreviews={screenshotPreviews}
      isSubmitting={isSubmitting}
      submitError={submitError}
      submitSuccess={submitSuccess}
      onMessageChange={onMessageChange}
      onFileSelect={onFileSelect}
      onRemoveScreenshot={onRemoveScreenshot}
      onClose={onClose}
      onSubmit={onSubmit}
      dialogRef={dialogRef}
      messageFieldRef={messageFieldRef}
      onDialogKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
          return;
        }

        if (event.key !== "Tab" || !dialogRef.current) {
          return;
        }

        const focusableElements = getHomeFeedbackFocusableElements(dialogRef.current);
        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
        const trapTargetIndex = getHomeFeedbackFocusTrapTarget({
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
          dialogRef.current.focus();
        }
      }}
    />
  );
}
