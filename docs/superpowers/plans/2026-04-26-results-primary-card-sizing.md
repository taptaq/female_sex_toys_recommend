# Results Primary Card Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 轻微缩小推荐结果页的第一个产品卡片，同时保持与 Top2、Top3 的视觉层级协调。

**Architecture:** 仅在 `ResultsPage.tsx` 内部调整首卡的图片比例和内容留白，不改动数据流和组件边界。通过最小样式修改让主推荐更紧凑，但继续保持首卡作为主视觉焦点。

**Tech Stack:** React, TypeScript, Tailwind CSS, Motion

---

### Task 1: 调整首卡样式

**Files:**
- Modify: `src/pages/ResultsPage.tsx`
- Test: `npx tsc --noEmit`
- Test: `npm run build`

- [ ] **Step 1: 收紧首卡图片比例**

将首卡图片容器从更高的比例改成稍扁一些的比例，只影响第一个推荐项：

```tsx
<div className="relative mb-3 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black/20 sm:aspect-[2.6/1]">
```

- [ ] **Step 2: 收紧首卡内容留白**

同步减少首卡内容区和局部块级间距，让卡片更利落：

```tsx
<div className="px-3 pb-3 sm:px-4 sm:pb-4">
```

并把与图片区、标签、理由、指标相关的 `mb-4` / `mt-4` 适度降到 `mb-3` / `mt-3`。

- [ ] **Step 3: 运行 TypeScript 校验**

Run: `npx tsc --noEmit`
Expected: PASS with no TypeScript errors

- [ ] **Step 4: 运行生产构建校验**

Run: `npm run build`
Expected: PASS and generate the production bundle successfully
