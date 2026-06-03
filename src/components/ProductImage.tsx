import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  getProductImagePlaceholderValue,
  isDefaultGradientPlaceholder,
  isImagePlaceholder,
} from "../lib/product-image-placeholders.ts";

const DEFAULT_FALLBACK_CLASS_NAME =
  "bg-gradient-to-br from-slate-900/90 via-slate-800/95 to-cyan-950/90";

function isRenderableProductImageSource(value: string) {
  const trimmed = value.trim();

  return (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\//i.test(trimmed) ||
    /^blob:/i.test(trimmed) ||
    /^\/assets\//i.test(trimmed) || // 支持本地图片路径
    /^[^?#]+\.(?:avif|webp|png|jpe?g|gif|svg)(?:[?#].*)?$/i.test(trimmed) ||
    isImagePlaceholder(trimmed) // 支持占位符图片
  );
}

export function getInitialProductImageState(imageValue: string) {
  const trimmed = imageValue.trim();
  const isRemoteImage = isRenderableProductImageSource(trimmed);

  return {
    isRemoteImage,
    resolvedImageClassName: isRemoteImage ? "" : trimmed,
  };
}

export function getNextProductImageStateOnError(imageValue: string) {
  const trimmed = imageValue.trim();

  return {
    isRemoteImage: false,
    resolvedImageClassName: isRenderableProductImageSource(trimmed) ? "" : trimmed,
  };
}

export function resolveProductImageValue({
  imageValue,
  typeCode,
  subtypeCode,
  gender,
  physicalForm,
}: {
  imageValue: string;
  typeCode?: string | null;
  subtypeCode?: string | null;
  gender?: "female" | "male" | "unisex" | null;
  physicalForm?: string | null;
}) {
  const trimmedImageValue = imageValue.trim();
  const hasTaxonomyPlaceholderSource = Boolean(
    subtypeCode || typeCode || physicalForm,
  );
  const taxonomyPlaceholderValue = hasTaxonomyPlaceholderSource
    ? getProductImagePlaceholderValue(
        subtypeCode,
        typeCode,
        gender,
        physicalForm,
      )
    : "";
  const shouldUseTaxonomyPlaceholder =
    !trimmedImageValue ||
    isDefaultGradientPlaceholder(trimmedImageValue) ||
    (hasTaxonomyPlaceholderSource &&
      !isRenderableProductImageSource(trimmedImageValue));

  return {
    resolvedImageValue: shouldUseTaxonomyPlaceholder
      ? taxonomyPlaceholderValue
      : trimmedImageValue,
    taxonomyPlaceholderValue,
  };
}

export function ProductImage({
  imageValue,
  typeCode,
  subtypeCode,
  gender,
  physicalForm,
  alt,
  iconClassName,
  imageClassName,
}: {
  imageValue: string;
  typeCode?: string | null;
  subtypeCode?: string | null;
  gender?: "female" | "male" | "unisex" | null;
  physicalForm?: string | null;
  alt: string;
  iconClassName: string;
  imageClassName: string;
}) {
  const { resolvedImageValue, taxonomyPlaceholderValue } =
    resolveProductImageValue({
      imageValue,
      typeCode,
      subtypeCode,
      gender,
      physicalForm,
    });
  const [activeImageValue, setActiveImageValue] = useState(resolvedImageValue);
  const [state, setState] = useState(() =>
    getInitialProductImageState(resolvedImageValue),
  );

  useEffect(() => {
    setActiveImageValue(resolvedImageValue);
    setState(getInitialProductImageState(resolvedImageValue));
  }, [resolvedImageValue]);

  const resolvedFallbackClassName =
    state.resolvedImageClassName || DEFAULT_FALLBACK_CLASS_NAME;
  const shouldShowTaxonomyPlaceholderBadge =
    Boolean(taxonomyPlaceholderValue) &&
    activeImageValue === taxonomyPlaceholderValue &&
    state.isRemoteImage;

  if (state.isRemoteImage) {
    return (
      <>
        <img
          src={activeImageValue}
          alt={alt}
          className={imageClassName}
          onError={() => {
            if (
              taxonomyPlaceholderValue &&
              activeImageValue !== taxonomyPlaceholderValue
            ) {
              setActiveImageValue(taxonomyPlaceholderValue);
              setState(getInitialProductImageState(taxonomyPlaceholderValue));
              return;
            }

            setState(getNextProductImageStateOnError(activeImageValue));
          }}
        />
        {shouldShowTaxonomyPlaceholderBadge ? (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-sky-200/70 bg-white/82 px-2.5 py-1.5 text-[10px] font-semibold leading-none text-sky-800 shadow-[0_10px_28px_rgba(14,165,233,0.18)] ring-1 ring-white/80 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-cyan-300 to-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
            类型产品占位参考图
          </span>
        ) : null}
      </>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${resolvedFallbackClassName}`}
      aria-label={`${alt} 默认图片`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(103,232,249,0.18),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.05),_transparent_45%,_rgba(34,211,238,0.08))]" />
      <Sparkles className={`relative z-10 ${iconClassName}`} />
    </div>
  );
}
