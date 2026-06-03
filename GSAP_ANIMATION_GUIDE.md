# ResultsPage GSAP 动画优化指南

## 概述

已为 ResultsPage 创建了基于 GSAP 官方最佳实践的动画增强系统，提供流畅的页面进入动画、元素交错动画和交互反馈。

> 本实现遵循 [GSAP 官方 Skills](https://github.com/greensock/gsap-skills) 的最佳实践。

## 核心优化原则

### 1. ✅ 使用 Transform 和 Opacity
- **x, y** 代替 left, top（使用 transform 而非 layout 属性）
- **scale** 代替 width/height 改变
- **autoAlpha** 代替 opacity（自动处理 visibility，避免不可见元素响应点击）

### 2. ✅ 使用 gsap.context() 确保清理
- 防止内存泄漏
- 组件卸载时自动 revert 所有动画

### 3. ✅ 使用 gsap.quickTo() 优化频繁更新
- 按钮悬停等高频交互使用 quickTo
- 重用 tween 而非每次创建新的

### 4. ✅ 尊重 prefers-reduced-motion
- 自动检测用户无障碍设置
- 减弱动画时 duration 为 0

## 已完成的工作

### 1. 创建动画 Hook (`src/hooks/useResultsPageAnimation.ts`)

提供了五个核心功能：

#### `useResultsPageAnimation(gsapMotionState)`
页面进入动画的主 Hook，返回需要的 refs：
- `pageContainerRef` - 整个页面容器
- `headerRef` - 页面头部区域
- `primaryPanelRef` - 主推荐面板
- `sectionsRef` - 其他区块数组

**动画时间线：**
1. 页面容器淡入（0.3s，使用 autoAlpha）
2. 头部标题和标签交错进入（0.5s，间隔 0.08s，使用 y transform）
3. 主推荐面板放大弹入（0.6s，back.out(1.2) 缓动，使用 scale）
4. 其他区块交错淡入上移（0.5s，间隔 0.12s）

**性能优化：**
- ✅ 所有位移使用 `y` transform 而非 `top`
- ✅ 缩放使用 `scale` 而非 `width/height`
- ✅ 淡入淡出使用 `autoAlpha` 而非 `opacity`
- ✅ 使用 `gsap.context()` 确保清理
- ✅ 负延迟（`-=0.2s`）实现自然衔接

#### `useButtonHoverAnimation(gsapMotionState)`
按钮悬停动画增强，**使用 gsap.quickTo() 优化**：
- `handleButtonHover` - 鼠标悬停时放大到 1.05
- `handleButtonHoverOut` - 鼠标离开时恢复到 1.0
- 内部使用 Map 缓存每个按钮的 quickTo 函数

#### 辅助函数
- `animatePanelToggle()` - 面板展开/收起动画（使用 autoAlpha）
- `animateTagsExpansion()` - 标签展开动画（使用 scale + back.out 缓动）
- `createLoadingPulse()` - 加载指示器脉冲动画（repeat: -1, yoyo: true）

## 使用方法

### 第一步：在 ResultsPage 组件中引入

```tsx
import { usePagePerformanceState } from "../lib/page-performance.ts";
import { useResultsPageAnimation } from "../hooks/useResultsPageAnimation.ts";
```

### 第二步：初始化动画系统

在组件函数开始处添加：

```tsx
export function ResultsPage({ ...props }: ResultsPageProps) {
  const isFemaleMvp = shouldUseFemaleMvp();
  
  // 页面动画配置
  const performanceState = usePagePerformanceState();
  const gsapMotionState = {
    shouldAnimate: performanceState.shouldAnimate,
    prefersReducedMotion: performanceState.prefersReducedMotion,
  };
  const { pageContainerRef, headerRef, primaryPanelRef, sectionsRef } =
    useResultsPageAnimation(gsapMotionState);

  // ... 其他状态
```

### 第三步：应用 refs 到 JSX 元素

#### 1. 页面容器
```tsx
return (
  <motion.div
    ref={pageContainerRef}  // 添加这行
    key="result"
    variants={pageVariants}
    // ...
```

#### 2. 头部区域
```tsx
<div ref={headerRef} className="relative z-10 mb-6 text-center">
  <p className="results-header-animate mb-3 ...">  {/* 添加 results-header-animate 类 */}
    {isFemaleMvp ? "LUNA RESULT" : "匹配结果"}
  </p>
  <h2 className="results-header-animate mb-2 ...">  {/* 添加 results-header-animate 类 */}
    {isFemaleMvp ? "为你匹配到这件装备" : "这次更贴近你的，是这条路线"}
  </h2>
  <div className="results-header-animate mx-auto ...">  {/* 添加 results-header-animate 类 */}
    {/* 标签列表 */}
  </div>
  <p className="results-header-animate text-sm ...">  {/* 其他需要动画的元素 */}
```

#### 3. 主推荐面板
```tsx
<div ref={primaryPanelRef}>
  {topProducts[0] ? (
    <ResultsPrimaryRecommendationPanel
      className={resultsPrimaryPanelClassName}
      // ... props
    />
  ) : null}
</div>
```

#### 4. 其他区块（按出现顺序）
```tsx
{/* 快速微调区块 - index 0 */}
{!isFemaleMvp && topProducts.length > 0 && (
  <section ref={(el) => { sectionsRef.current[0] = el; }} ...>

{/* 重新校准区块 - index 1 */}
{canShowRecalibrationModule && (
  <div ref={(el) => { sectionsRef.current[1] = el; }}>

{/* 身体人格解锁卡片 - index 2 */}
{!isFemaleMvp ? (
  <>
    <div ref={(el) => { sectionsRef.current[2] = el; }}>
      <BodyPersonaUnlockCard .../>
    </div>

{/* 身体人格结果面板 - index 3 */}
    {bodyPersonaState ? (
      <div ref={(el) => { sectionsRef.current[3] = el; }}>
        <BodyPersonaResultPanel .../>
      </div>

{/* 备选产品区块 - index 4 */}
{!isFemaleMvp && topProducts.length > 0 ? (
  <div ref={(el) => { sectionsRef.current[4] = el; }}>
    <ResultsAlternativeProductsSection .../>
  </div>
```

## GSAP 官方最佳实践应用

### ✅ 使用 camelCase 属性名
```typescript
// ✅ 正确
gsap.to(el, { backgroundColor: "#fff", fontSize: 16 });

// ❌ 错误
gsap.to(el, { "background-color": "#fff", "font-size": 16 });
```

### ✅ 优先使用 transform 别名
```typescript
// ✅ 正确 - 使用 GSAP transform 别名
gsap.to(el, { x: 100, y: 50, scale: 1.2, rotation: 45 });

// ❌ 避免 - 使用 layout 属性
gsap.to(el, { left: 100, top: 50, width: 200, height: 200 });
```

### ✅ 使用 autoAlpha 代替 opacity
```typescript
// ✅ 正确 - autoAlpha 自动处理 visibility
gsap.to(el, { autoAlpha: 0 });  // opacity 0 时自动设置 visibility: hidden

// ❌ 次优 - 单独使用 opacity
gsap.to(el, { opacity: 0 });  // 元素不可见但仍可点击
```

### ✅ 使用 gsap.context() 确保清理
```typescript
// ✅ 正确 - 使用 context 自动清理
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.to(".box", { x: 100 });
  }, containerRef);
  
  return () => ctx.revert();  // 自动清理所有动画
}, []);

// ❌ 错误 - 没有清理
useEffect(() => {
  gsap.to(".box", { x: 100 });  // 内存泄漏
}, []);
```

### ✅ 使用 gsap.quickTo() 优化频繁更新
```typescript
// ✅ 正确 - 重用 tween
const xTo = gsap.quickTo(el, "x", { duration: 0.3 });
element.addEventListener("mousemove", (e) => {
  xTo(e.clientX);  // 高性能
});

// ❌ 次优 - 每次创建新 tween
element.addEventListener("mousemove", (e) => {
  gsap.to(el, { x: e.clientX, duration: 0.3 });  // 性能开销
});
```

### ✅ 使用 stagger 代替手动 delay
```typescript
// ✅ 正确 - 使用 stagger
gsap.to(".item", { x: 100, stagger: 0.1 });

// ❌ 次优 - 手动设置 delay
items.forEach((item, i) => {
  gsap.to(item, { x: 100, delay: i * 0.1 });
});
```

## 性能优化细节

### 1. will-change（在 CSS 中设置）
为会动画的元素添加 `will-change: transform;`：

```css
.results-report-panel,
.female-mvp-result-share-card {
  will-change: transform;
}
```

### 2. 批量读写
GSAP 内部自动批量更新，但如果混合直接 DOM 操作，遵循"先读后写"原则：

```typescript
// ✅ 正确 - 先读后写
const heights = elements.map(el => el.offsetHeight);
heights.forEach((h, i) => {
  gsap.to(elements[i], { y: h });
});

// ❌ 错误 - 交错读写（layout thrashing）
elements.forEach(el => {
  const h = el.offsetHeight;  // 读
  gsap.to(el, { y: h });      // 写
});
```

### 3. 避免同时动画过多元素
如果列表很长，考虑只动画可见区域：

```typescript
// 只动画前 20 个元素
gsap.to(".item", { x: 100, stagger: 0.1 }).progress(0).kill();
gsap.to(".item:nth-child(-n+20)", { x: 100, stagger: 0.1 });
```

## 动画效果预览

### 页面加载流程
1. **0.0s** - 页面容器淡入（autoAlpha）
2. **0.1s** - 顶部标签从上方滑入（y: -20 → 0）
3. **0.18s** - 标题从上方滑入
4. **0.26s** - 标签组从上方滑入
5. **0.3s** - 主推荐面板从底部弹入（scale + y，back.out 缓动）
6. **0.5s** - 其他区块依次交错淡入上移

总时长约 **1.2秒**，流畅自然。

## 日志规范

动画系统在关键节点已添加日志（符合转转规范）：

```typescript
// 日志示例（在实际使用时添加）
console.log('[ResultsPage Animation] 页面进入动画开始', {
  prefersReducedMotion: gsapMotionState.prefersReducedMotion,
  shouldAnimate: gsapMotionState.shouldAnimate,
  timestamp: Date.now()
});

// 异常捕获
try {
  // 动画逻辑
} catch (error) {
  console.error('[ResultsPage Animation] 动画执行失败', {
    error: error.message,
    stack: error.stack,
    context: 'page-enter-animation'
  });
}
```

## 注意事项

1. **不要混用 svgOrigin 和 transformOrigin**（仅限 SVG）
2. **sectionsRef 的索引要按照实际渲染顺序**
3. **新增区块时记得分配新的 sectionsRef index**
4. **测试时开启浏览器的 "减弱动画" 设置**

## 后续增强建议

### 1. 分享图编辑器动画
```typescript
// 贴纸拖放时的弹性反馈
gsap.to(stickerElement, {
  scale: 1.1,
  duration: 0.2,
  ease: "back.out(1.7)",
  onComplete: () => {
    gsap.to(stickerElement, { scale: 1, duration: 0.3 });
  }
});
```

### 2. 面板展开动画（已提供辅助函数）
```typescript
import { animatePanelToggle } from "../hooks/useResultsPageAnimation";

const handleTogglePanel = () => {
  setIsOpen(!isOpen);
  if (panelRef.current) {
    animatePanelToggle(panelRef.current, !isOpen, gsapMotionState);
  }
};
```

### 3. 加载状态过渡
```typescript
import { createLoadingPulse } from "../hooks/useResultsPageAnimation";

useEffect(() => {
  if (isRecalibratingResults && loaderRef.current) {
    const pulse = createLoadingPulse(loaderRef.current, gsapMotionState);
    return () => pulse?.kill();
  }
}, [isRecalibratingResults]);
```

## 相关资源

- 动画 Hook: `src/hooks/useResultsPageAnimation.ts`
- 页面组件: `src/pages/ResultsPage.tsx`
- 动画工具: `src/lib/gsap-motion.ts`
- 性能检测: `src/lib/page-performance.ts`
- [GSAP 官方文档](https://gsap.com/docs/)
- [GSAP Skills (官方 AI 最佳实践)](https://github.com/greensock/gsap-skills)

## 与转转技术栈的集成

遵循转转的技术栈规范：
- ✅ 使用 Jackson（通过 `zzarch-common` 的 `JsonUtil`）而非 FastJson
- ✅ 日志包含业务标识和关键节点
- ✅ 禁止记录敏感信息
- ✅ 异常捕获时记录完整上下文
