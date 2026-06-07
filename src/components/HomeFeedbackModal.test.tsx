import assert from "node:assert/strict";
import test from "node:test";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  HomeFeedbackModal,
  HomeFeedbackModalView,
  beginHomeFeedbackFocusSession,
  focusHomeFeedbackActiveTarget,
  getHomeFeedbackFocusTrapTarget,
  restoreHomeFeedbackFocus,
} from "./HomeFeedbackModal.tsx";

function collectElements(node: unknown): any[] {
  if (!isValidElement(node)) {
    if (Array.isArray(node)) {
      return node.flatMap((child) => collectElements(child));
    }

    return [];
  }

  const children = (node.props as { children?: unknown }).children;
  return [node, ...collectElements(children)];
}

test("home feedback modal renders nothing when closed", () => {
  const html = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen={false}
      message=""
      screenshotPreviews={[]}
      isSubmitting={false}
      submitError={null}
      submitSuccess={null}
      onMessageChange={() => {}}
      onFileSelect={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.equal(html, "");
});

test("home feedback modal renders the required shell when open", () => {
  const blankHtml = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen={true}
      message=""
      screenshotPreviews={[]}
      isSubmitting={false}
      submitError={null}
      submitSuccess={null}
      onMessageChange={() => {}}
      onFileSelect={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  const filledHtml = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen={true}
      message="这里可以更清楚一点"
      screenshotPreviews={[]}
      isSubmitting={false}
      submitError={null}
      submitSuccess={null}
      onMessageChange={() => {}}
      onFileSelect={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.match(blankHtml, /意见反馈/);
  assert.match(blankHtml, /反馈内容/);
  assert.match(blankHtml, /截图上传（可选，最多 3 张）/);
  assert.match(blankHtml, /提交反馈/);
  assert.match(blankHtml, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(blankHtml, /required=""/);
  assert.match(blankHtml, /role="dialog"/);
  assert.match(blankHtml, /aria-modal="true"/);
  assert.match(blankHtml, /aria-labelledby="home-feedback-modal-title"/);
  assert.match(blankHtml, /tabindex="-1"/);
  assert.match(blankHtml, /type="submit"[^>]*disabled=""/);
  assert.match(blankHtml, /bg-white\/95/);
  assert.doesNotMatch(blankHtml, /bg-slate-950/);
  assert.doesNotMatch(filledHtml, /type="submit"[^>]*disabled=""/);
});

test("home feedback modal focus trap helper loops at dialog boundaries", () => {
  assert.equal(
    getHomeFeedbackFocusTrapTarget({
      focusableCount: 4,
      currentIndex: 3,
      isShiftKey: false,
    }),
    0,
  );
  assert.equal(
    getHomeFeedbackFocusTrapTarget({
      focusableCount: 4,
      currentIndex: 0,
      isShiftKey: true,
    }),
    3,
  );
  assert.equal(
    getHomeFeedbackFocusTrapTarget({
      focusableCount: 4,
      currentIndex: 1,
      isShiftKey: false,
    }),
    null,
  );
  assert.equal(
    getHomeFeedbackFocusTrapTarget({
      focusableCount: 4,
      currentIndex: -1,
      isShiftKey: false,
    }),
    0,
  );
});

test("home feedback modal focus restore helper safely restores when possible", () => {
  let focusCount = 0;

  assert.equal(
    restoreHomeFeedbackFocus({
      focus() {
        focusCount += 1;
      },
    }),
    true,
  );
  assert.equal(focusCount, 1);
  assert.equal(restoreHomeFeedbackFocus(null), false);
  assert.equal(restoreHomeFeedbackFocus({}), false);
});

test("home feedback modal only restores background focus when the session ends", () => {
  let backgroundFocusCount = 0;
  let dialogFocusCount = 0;
  let messageFocusCount = 0;

  const restoreFocus = beginHomeFeedbackFocusSession({
    activeElement: {
      focus() {
        backgroundFocusCount += 1;
      },
    },
    isSubmitting: false,
    dialog: {
      focus() {
        dialogFocusCount += 1;
      },
    },
    messageField: {
      focus() {
        messageFocusCount += 1;
      },
    },
  });

  assert.equal(messageFocusCount, 1);
  assert.equal(dialogFocusCount, 0);
  assert.equal(backgroundFocusCount, 0);

  focusHomeFeedbackActiveTarget({
    isSubmitting: true,
    dialog: {
      focus() {
        dialogFocusCount += 1;
      },
    },
    messageField: {
      focus() {
        messageFocusCount += 1;
      },
    },
  });

  assert.equal(dialogFocusCount, 1);
  assert.equal(messageFocusCount, 1);
  assert.equal(backgroundFocusCount, 0);

  restoreFocus();

  assert.equal(backgroundFocusCount, 1);
});

test("home feedback modal can render screenshot previews and status messages", () => {
  const html = renderToStaticMarkup(
    <HomeFeedbackModal
      isOpen={true}
      message="首页文案这里有点绕"
      screenshotPreviews={["data:image/png;base64,aaa", "data:image/webp;base64,bbb"]}
      isSubmitting={true}
      submitError="最多上传 3 张截图"
      submitSuccess="反馈提交成功"
      onMessageChange={() => {}}
      onFileSelect={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.match(html, /首页文案这里有点绕/);
  assert.match(html, /反馈截图预览 1/);
  assert.match(html, /反馈截图预览 2/);
  assert.match(html, /移除截图/);
  assert.match(html, /最多上传 3 张截图/);
  assert.match(html, /反馈提交成功/);
  assert.match(html, /提交中\.\.\./);
});

test("home feedback modal wires overlay close and form submit callbacks", () => {
  let closeCount = 0;
  let submitCount = 0;

  const elementTree = HomeFeedbackModalView({
    isOpen: true,
    message: "需要优化首页说明",
    screenshotPreviews: [],
    isSubmitting: false,
    submitError: null,
    submitSuccess: null,
    onMessageChange: () => {},
    onFileSelect: () => {},
    onRemoveScreenshot: () => {},
    onClose: () => {
      closeCount += 1;
    },
    onSubmit: () => {
      submitCount += 1;
    },
    onDialogKeyDown: (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeCount += 1;
      }
    },
  });

  const elements = collectElements(elementTree);
  const overlay = elements.find((element) => element.props.role === "presentation");
  const form = elements.find((element) => element.type === "form");
  const dialog = elements.find((element) => element.props.role === "dialog");

  overlay.props.onClick();
  dialog.props.onKeyDown({ key: "Escape", stopPropagation() {} });
  form.props.onSubmit({ preventDefault() {} });

  assert.equal(closeCount, 2);
  assert.equal(submitCount, 1);
});

test("home feedback modal wires screenshot removal callback with the right index", () => {
  const removedIndexes: number[] = [];

  const elementTree = HomeFeedbackModalView({
    isOpen: true,
    message: "这里的按钮层级有点乱",
    screenshotPreviews: ["data:image/png;base64,aaa", "data:image/jpeg;base64,bbb"],
    isSubmitting: false,
    submitError: null,
    submitSuccess: null,
    onMessageChange: () => {},
    onFileSelect: () => {},
    onRemoveScreenshot: (index) => {
      removedIndexes.push(index);
    },
    onClose: () => {},
    onSubmit: () => {},
    onDialogKeyDown: () => {},
  });

  const elements = collectElements(elementTree);
  const removeButtons = elements.filter(
    (element) => element.type === "button" && element.props.type === "button" && element.props.children === "移除截图",
  );

  removeButtons[1].props.onClick();

  assert.deepEqual(removedIndexes, [1]);
});
