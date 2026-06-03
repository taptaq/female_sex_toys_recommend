import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { getGsapDuration, shouldRunGsapMotion, type GsapMotionState } from "../lib/gsap-motion.ts";

gsap.registerPlugin(MotionPathPlugin);

const LUNA_FLIGHT_ACTIVE_CLASS =
  "female-mvp-result-share-card__stage-scene--luna-flight";
const LUNA_FLIGHT_DELAY_SECONDS = 1.5;

function createLunaFlightElement(
  lunaImage: HTMLImageElement,
  finalRect: DOMRect,
) {
  if (lunaImage.complete && lunaImage.naturalWidth > 0) {
    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (context) {
      const sourceAspectRatio = lunaImage.naturalWidth / lunaImage.naturalHeight;
      const targetAspectRatio = finalRect.width / finalRect.height;
      let drawWidth = finalRect.width;
      let drawHeight = finalRect.height;
      let drawX = 0;
      let drawY = 0;

      if (sourceAspectRatio > targetAspectRatio) {
        drawHeight = drawWidth / sourceAspectRatio;
        drawY = (finalRect.height - drawHeight) / 2;
      } else {
        drawWidth = drawHeight * sourceAspectRatio;
        drawX = (finalRect.width - drawWidth) / 2;
      }

      canvas.width = Math.max(1, Math.round(finalRect.width * devicePixelRatio));
      canvas.height = Math.max(1, Math.round(finalRect.height * devicePixelRatio));
      context.scale(devicePixelRatio, devicePixelRatio);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(lunaImage, drawX, drawY, drawWidth, drawHeight);
      return canvas;
    }
  }

  const imageClone = document.createElement("img");
  imageClone.src = lunaImage.currentSrc || lunaImage.src;
  imageClone.alt = "";
  imageClone.decoding = "async";
  return imageClone;
}

function createLunaFlightClone(
  lunaImage: HTMLImageElement,
  lunaFigure: HTMLElement,
) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }

  const finalRect = lunaFigure.getBoundingClientRect();
  if (finalRect.width <= 0 || finalRect.height <= 0) {
    return null;
  }

  const startX = Math.max(18, Math.min(window.innerWidth * 0.08, 56));
  const startY = Math.max(52, Math.min(window.innerHeight * 0.07, 70));
  const flightClone = createLunaFlightElement(lunaImage, finalRect);
  const lunaArcPath = [
    { x: startX, y: startY },
    { x: startX + finalRect.width * 0.46, y: startY + finalRect.height * 0.54 },
    {
      x: finalRect.left - finalRect.width * 0.82,
      y: finalRect.top - finalRect.height * 0.32,
    },
    { x: finalRect.left, y: finalRect.top },
  ];

  flightClone.setAttribute("aria-hidden", "true");
  flightClone.className = "female-mvp-result-share-card__luna-flight-clone";
  flightClone.style.width = `${finalRect.width}px`;
  flightClone.style.height = `${finalRect.height}px`;
  flightClone.style.opacity = "0";
  flightClone.style.visibility = "hidden";
  gsap.set(flightClone, {
    x: startX,
    y: startY,
    opacity: 0,
    visibility: "hidden",
    scale: 0.88,
    rotate: -16,
    force3D: true,
    transformOrigin: "50% 58%",
  });
  document.body.appendChild(flightClone);

  return {
    flightClone,
    lunaArcPath,
  };
}

/**
 * ResultsPage 页面进入动画 Hook
 * 基于 GSAP 官方最佳实践实现流畅的页面加载动画
 *
 * 性能优化：
 * - 使用 transform 属性（x, y, scale）而非 layout 属性
 * - 使用 autoAlpha 代替 opacity 实现淡入淡出
 * - 使用 gsap.context() 确保动画正确清理
 * - 尊重用户的 prefers-reduced-motion 设置
 */
export function useResultsPageAnimation(gsapMotionState: GsapMotionState) {
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const primaryPanelRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!shouldRunGsapMotion(gsapMotionState)) return;

    // 使用 gsap.context() 确保动画正确清理
    const ctx = gsap.context(() => {
      // 创建主时间轴，使用统一的默认缓动
      const tl = gsap.timeline({
        defaults: {
          ease: "power2.out"
        }
      });

      // 1. 页面容器淡入（使用 autoAlpha 而非 opacity）
      if (pageContainerRef.current) {
        tl.fromTo(
          pageContainerRef.current,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: getGsapDuration(0.3, gsapMotionState)
          }
        );
      }

      // 2. 头部元素交错进入（优先使用 transform 属性 y）
      if (headerRef.current) {
        const headerElements = headerRef.current.querySelectorAll(".results-header-animate");
        if (headerElements.length > 0) {
          tl.fromTo(
            headerElements,
            {
              autoAlpha: 0,
              y: -20  // 使用 transform 的 y 而非 top
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: getGsapDuration(0.5, gsapMotionState),
              stagger: getGsapDuration(0.08, gsapMotionState),  // 交错动画
            },
            "-=0.2"  // 负延迟实现自然衔接
          );
        }
      }

      // 3. 主推荐面板放大进入（带弹性效果）
      if (primaryPanelRef.current) {
        tl.fromTo(
          primaryPanelRef.current,
          {
            autoAlpha: 0,
            scale: 0.95,  // 使用 scale 而非 width/height
            y: 20
          },
          {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: getGsapDuration(0.6, gsapMotionState),
            ease: "back.out(1.2)",  // 弹性缓动，官方推荐
          },
          "-=0.3"
        );
      }

      // 4. 其他区块交错淡入上移
      const validSections = sectionsRef.current.filter((el) => el !== null);
      if (validSections.length > 0) {
        tl.fromTo(
          validSections,
          {
            autoAlpha: 0,
            y: 30
          },
          {
            autoAlpha: 1,
            y: 0,
            duration: getGsapDuration(0.5, gsapMotionState),
            stagger: getGsapDuration(0.12, gsapMotionState),
            ease: "power2.out",
          },
          "-=0.4"
        );
      }
    }, pageContainerRef);

    // 组件卸载时清理动画，防止内存泄漏
    return () => ctx.revert();
  }, [gsapMotionState.shouldAnimate, gsapMotionState.prefersReducedMotion]);

  return {
    pageContainerRef,
    headerRef,
    primaryPanelRef,
    sectionsRef,
  };
}

export function useLunaResultStageAnimation(gsapMotionState: GsapMotionState) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !shouldRunGsapMotion(gsapMotionState)) return;

    let removePointerListeners: (() => void) | null = null;
    let removeFlightClone: (() => void) | null = null;

    const ctx = gsap.context(() => {
      const stageLight = stage.querySelector<HTMLElement>(
        ".female-mvp-result-share-card__stage-light",
      );
      const lunaFigure = stage.querySelector<HTMLElement>(
        ".female-mvp-result-share-card__luna-figure",
      );
      const lunaImage = stage.querySelector<HTMLImageElement>(
        ".female-mvp-result-share-card__luna",
      );
      const stageCaption = stage.querySelector<HTMLElement>(
        ".female-mvp-result-share-card__stage-caption",
      );
      const askItems = stage.parentElement?.querySelectorAll<HTMLElement>(
        ".female-mvp-result-share-card__ask-item",
      );

      const tl = gsap.timeline({
        defaults: {
          ease: "power2.out",
        },
      });

      tl.fromTo(
        stage,
        { autoAlpha: 0, scale: 0.985, y: 10 },
        {
          autoAlpha: 1,
          scale: 1,
          y: 0,
          duration: getGsapDuration(0.35, gsapMotionState),
        },
      );

      if (stageLight) {
        tl.fromTo(
          stageLight,
          { autoAlpha: 0, scale: 0.82 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: getGsapDuration(0.5, gsapMotionState),
          },
          "<",
        );
      }

      if (lunaFigure) {
        const lunaFlightStart = getGsapDuration(LUNA_FLIGHT_DELAY_SECONDS, gsapMotionState);
        const lunaFlight = lunaImage
          ? createLunaFlightClone(lunaImage, lunaFigure)
          : null;

        tl.set(
          lunaFigure,
          {
            x: 0,
            y: 0,
            opacity: 0,
            visibility: "hidden",
            scale: 1,
            rotate: 0,
          },
          0,
        );

        if (lunaFlight) {
          const { flightClone, lunaArcPath } = lunaFlight;
          removeFlightClone = () => {
            flightClone.remove();
            stage.classList.remove(LUNA_FLIGHT_ACTIVE_CLASS);
          };

          tl.call(
            () => {
              stage.classList.add(LUNA_FLIGHT_ACTIVE_CLASS);
            },
            [],
            lunaFlightStart,
          ).set(
            flightClone,
            {
              x: lunaArcPath[0].x,
              y: lunaArcPath[0].y,
              opacity: 0.96,
              visibility: "visible",
              scale: 0.88,
              rotate: -16,
              force3D: true,
            },
            lunaFlightStart,
          ).to(
            flightClone,
            {
              opacity: 1,
              scale: 1,
              rotate: 0,
              autoRound: false,
              force3D: true,
              motionPath: {
                path: lunaArcPath,
                curviness: 1.25,
              },
              duration: getGsapDuration(1.38, gsapMotionState),
              ease: "power2.inOut",
            },
            "<0.08",
          ).set(
            lunaFigure,
            {
              opacity: 1,
              visibility: "visible",
            },
            ">-0.08",
          ).to(
            flightClone,
            {
              opacity: 0,
              duration: getGsapDuration(0.08, gsapMotionState),
              onComplete: () => {
                removeFlightClone?.();
                removeFlightClone = null;
              },
            },
            "<",
          );
        } else {
          tl.set(
            lunaFigure,
            {
              visibility: "visible",
            },
            "<",
          ).to(
            lunaFigure,
            {
              opacity: 1,
              duration: getGsapDuration(0.2, gsapMotionState),
            },
            "<0.08",
          );
        }
      }

      if (stageCaption) {
        tl.fromTo(
          stageCaption,
          { autoAlpha: 0, y: 18, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: getGsapDuration(0.42, gsapMotionState),
          },
          "<0.04",
        );
      }

      if (askItems?.length) {
        tl.fromTo(
          askItems,
          { autoAlpha: 0, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            duration: getGsapDuration(0.28, gsapMotionState),
            stagger: getGsapDuration(0.06, gsapMotionState),
          },
          ">-0.14",
        );
      }

      if (!lunaFigure) return;

      const moveFigureX = gsap.quickTo(lunaFigure, "x", {
        duration: getGsapDuration(0.36, gsapMotionState),
        ease: "power2.out",
      });
      const moveFigureY = gsap.quickTo(lunaFigure, "y", {
        duration: getGsapDuration(0.36, gsapMotionState),
        ease: "power2.out",
      });
      const rotateFigure = gsap.quickTo(lunaFigure, "rotate", {
        duration: getGsapDuration(0.36, gsapMotionState),
        ease: "power2.out",
      });
      const moveLightX = stageLight
        ? gsap.quickTo(stageLight, "x", {
            duration: getGsapDuration(0.46, gsapMotionState),
            ease: "power2.out",
          })
        : null;
      const moveLightY = stageLight
        ? gsap.quickTo(stageLight, "y", {
            duration: getGsapDuration(0.46, gsapMotionState),
            ease: "power2.out",
          })
        : null;

      const clampUnit = gsap.utils.clamp(-1, 1);

      const handlePointerMove = (event: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        const xRatio = clampUnit(
          gsap.utils.mapRange(rect.left, rect.right, -1, 1, event.clientX),
        );
        const yRatio = clampUnit(
          gsap.utils.mapRange(rect.top, rect.bottom, -1, 1, event.clientY),
        );

        moveFigureX(xRatio * 7);
        moveFigureY(yRatio * 5);
        rotateFigure(xRatio * 2.2);
        moveLightX?.(xRatio * -5);
        moveLightY?.(yRatio * -4);
      };

      const handlePointerLeave = () => {
        moveFigureX(0);
        moveFigureY(0);
        rotateFigure(0);
        moveLightX?.(0);
        moveLightY?.(0);
      };

      stage.addEventListener("pointermove", handlePointerMove);
      stage.addEventListener("pointerleave", handlePointerLeave);

      removePointerListeners = () => {
        stage.removeEventListener("pointermove", handlePointerMove);
        stage.removeEventListener("pointerleave", handlePointerLeave);
      };
    }, stage);

    return () => {
      removePointerListeners?.();
      removeFlightClone?.();
      ctx.revert();
    };
  }, [gsapMotionState.shouldAnimate, gsapMotionState.prefersReducedMotion]);

  return stageRef;
}

/**
 * 按钮悬停动画增强
 * 使用 gsap.quickTo() 优化频繁更新的属性
 */
export function useButtonHoverAnimation(gsapMotionState: GsapMotionState) {
  const quickToScaleRef = useRef<Map<HTMLElement, gsap.QuickToFunc>>(new Map());

  const handleButtonHover = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldRunGsapMotion(gsapMotionState)) return;

    const target = event.currentTarget;

    // 使用 gsap.quickTo() 优化频繁触发的动画
    if (!quickToScaleRef.current.has(target)) {
      quickToScaleRef.current.set(
        target,
        gsap.quickTo(target, "scale", {
          duration: getGsapDuration(0.2, gsapMotionState),
          ease: "power1.out",
        })
      );
    }

    const quickTo = quickToScaleRef.current.get(target);
    quickTo?.(1.05);
  };

  const handleButtonHoverOut = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldRunGsapMotion(gsapMotionState)) return;

    const target = event.currentTarget;
    const quickTo = quickToScaleRef.current.get(target);
    quickTo?.(1);
  };

  return {
    handleButtonHover,
    handleButtonHoverOut,
  };
}

/**
 * 面板展开/收起动画
 * 使用 height: "auto" 实现自适应高度动画
 */
export function animatePanelToggle(
  element: HTMLElement,
  isOpen: boolean,
  gsapMotionState: GsapMotionState
) {
  if (!shouldRunGsapMotion(gsapMotionState)) return;

  if (isOpen) {
    gsap.fromTo(
      element,
      { height: 0, autoAlpha: 0 },
      {
        height: "auto",
        autoAlpha: 1,
        duration: getGsapDuration(0.4, gsapMotionState),
        ease: "power2.out",
      }
    );
  } else {
    gsap.to(element, {
      height: 0,
      autoAlpha: 0,
      duration: getGsapDuration(0.3, gsapMotionState),
      ease: "power2.in",
    });
  }
}

/**
 * 标签展开动画
 * 使用 scale 和 stagger 实现弹性交错效果
 */
export function animateTagsExpansion(
  container: HTMLElement,
  newTags: NodeListOf<Element>,
  gsapMotionState: GsapMotionState
) {
  if (!shouldRunGsapMotion(gsapMotionState)) return;

  gsap.fromTo(
    newTags,
    {
      autoAlpha: 0,
      scale: 0.8,  // 使用 scale 而非 width/height
      y: -10
    },
    {
      autoAlpha: 1,
      scale: 1,
      y: 0,
      duration: getGsapDuration(0.3, gsapMotionState),
      stagger: getGsapDuration(0.05, gsapMotionState),
      ease: "back.out(1.5)",  // 弹性缓动
    }
  );
}

/**
 * 加载指示器脉冲动画
 * 使用 repeat: -1 实现无限循环
 */
export function createLoadingPulse(
  element: HTMLElement,
  gsapMotionState: GsapMotionState
) {
  if (!shouldRunGsapMotion(gsapMotionState)) {
    return null;
  }

  return gsap.to(element, {
    scale: 1.1,
    autoAlpha: 0.6,
    duration: getGsapDuration(0.8, gsapMotionState),
    repeat: -1,
    yoyo: true,
    ease: "power1.inOut",
  });
}
