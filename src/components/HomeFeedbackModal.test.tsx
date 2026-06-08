import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
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

function getCssBlock(input: string, selector: string) {
  const selectorIndex = input.indexOf(selector);
  if (selectorIndex === -1) return "";

  const blockStart = input.indexOf("{", selectorIndex);
  const blockEnd = input.indexOf("}", blockStart);
  if (blockStart === -1 || blockEnd === -1) return "";

  return input.slice(blockStart + 1, blockEnd);
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
      pageRoute=""
      onMessageChange={() => {}}
      onPageRouteChange={() => {}}
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
      pageRoute=""
      onMessageChange={() => {}}
      onPageRouteChange={() => {}}
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
      pageRoute=""
      onMessageChange={() => {}}
      onPageRouteChange={() => {}}
      onFileSelect={() => {}}
      onRemoveScreenshot={() => {}}
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  );

  assert.match(blankHtml, /意见反馈/);
  assert.match(blankHtml, /home-feedback-modal-shell/);
  assert.match(blankHtml, /把体验问题、文案疑惑、想补上的能力都告诉我们。/);
  assert.match(blankHtml, /问题页面（可选）/);
  assert.match(blankHtml, /请选择页面/);
  assert.match(blankHtml, /问答页/);
  assert.match(blankHtml, /产品库/);
  assert.match(blankHtml, /推荐结果页/);
  assert.match(blankHtml, /登录注册/);
  assert.doesNotMatch(blankHtml, /知识星云/);
  assert.match(blankHtml, /反馈内容/);
  assert.match(blankHtml, /例如：我在产品库页面筛选“安静 \+ 防水”后/);
  assert.match(blankHtml, /希望可以帮忙检查一下筛选逻辑。/);
  assert.match(blankHtml, /截图上传（可选，最多 2 张）/);
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
  assert.doesNotMatch(blankHtml, /后续会继续补齐提交流程/);
  assert.doesNotMatch(filledHtml, /type="submit"[^>]*disabled=""/);
});

test("home feedback modal shell scrolls within the viewport when screenshots make it tall", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const modalShellBlock = getCssBlock(cssSource, ".home-feedback-modal-shell");

  assert.match(modalShellBlock, /max-height: calc\(100dvh - 2rem\);/);
  assert.match(modalShellBlock, /overflow-x: hidden;/);
  assert.match(modalShellBlock, /overflow-y: auto;/);
  assert.match(modalShellBlock, /overscroll-behavior: contain;/);
  assert.doesNotMatch(modalShellBlock, /overflow: hidden;/);
});

test("home feedback modal submit button uses a prominent readable primary style", () => {
  const cssSource = fs.readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
  const buttonBlock = getCssBlock(cssSource, ".home-feedback-submit-button:not(:disabled)");
  const disabledButtonBlock = getCssBlock(cssSource, ".home-feedback-submit-button:disabled");
  const elementTree = HomeFeedbackModalView({
    isOpen: true,
    message: "按钮文字要更清楚",
    screenshotPreviews: [],
    isSubmitting: false,
    submitError: null,
    submitSuccess: null,
    pageRoute: "",
    onMessageChange: () => {},
    onPageRouteChange: () => {},
    onFileSelect: () => {},
    onRemoveScreenshot: () => {},
    onClose: () => {},
    onSubmit: () => {},
    onDialogKeyDown: () => {},
  });

  const elements = collectElements(elementTree);
  const submitButton = elements.find(
    (element) => element.type === "button" && element.props.type === "submit",
  );

  assert.match(submitButton.props.className, /home-feedback-submit-button/);
  assert.match(submitButton.props.className, /bg-sky-700/);
  assert.match(submitButton.props.className, /text-sky-950/);
  assert.doesNotMatch(submitButton.props.className, /text-white/);
  assert.match(submitButton.props.className, /disabled:bg-slate-100/);
  assert.match(submitButton.props.className, /disabled:text-slate-500/);
  assert.doesNotMatch(submitButton.props.className, /disabled:opacity-55/);
  assert.match(buttonBlock, /background: rgb\(3, 105, 161\);/);
  assert.match(buttonBlock, /color: rgb\(8, 47, 73\);/);
  assert.match(disabledButtonBlock, /background: rgb\(241, 245, 249\);/);
  assert.match(disabledButtonBlock, /color: rgb\(100, 116, 139\);/);
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
      submitError="最多上传 2 张截图"
      submitSuccess="反馈提交成功"
      pageRoute="/library"
      onMessageChange={() => {}}
      onPageRouteChange={() => {}}
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
  assert.match(html, /最多上传 2 张截图/);
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
    pageRoute: "",
    onMessageChange: () => {},
    onPageRouteChange: () => {},
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

test("home feedback modal wires optional page selection callback", () => {
  let selectedPageRoute = "";

  const elementTree = HomeFeedbackModalView({
    isOpen: true,
    message: "产品库筛选有点奇怪",
    screenshotPreviews: [],
    isSubmitting: false,
    submitError: null,
    submitSuccess: null,
    pageRoute: "/library",
    onMessageChange: () => {},
    onPageRouteChange: (pageRoute) => {
      selectedPageRoute = pageRoute;
    },
    onFileSelect: () => {},
    onRemoveScreenshot: () => {},
    onClose: () => {},
    onSubmit: () => {},
    onDialogKeyDown: () => {},
  });

  const elements = collectElements(elementTree);
  const pageSelect = elements.find(
    (element) => element.type === "select" && element.props.id === "home-feedback-page-route",
  );

  assert.equal(pageSelect.props.value, "/library");
  pageSelect.props.onChange({ target: { value: "/quiz" } });
  assert.equal(selectedPageRoute, "/quiz");
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
    pageRoute: "",
    onMessageChange: () => {},
    onPageRouteChange: () => {},
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
