import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const DEFAULT_FALLBACK_CLASS_NAME =
  "bg-gradient-to-br from-slate-900/90 via-slate-800/95 to-cyan-950/90";

function isRenderableProductImageSource(value: string) {
  const trimmed = value.trim();

  return (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\//i.test(trimmed) ||
    /^blob:/i.test(trimmed)
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

export function ProductImage({
  imageValue,
  alt,
  iconClassName,
  imageClassName,
}: {
  imageValue: string;
  alt: string;
  iconClassName: string;
  imageClassName: string;
}) {
  const [state, setState] = useState(() => getInitialProductImageState(imageValue));

  useEffect(() => {
    setState(getInitialProductImageState(imageValue));
  }, [imageValue]);

  const resolvedFallbackClassName =
    state.resolvedImageClassName || DEFAULT_FALLBACK_CLASS_NAME;

  if (state.isRemoteImage) {
    return (
      <img
        src={imageValue}
        alt={alt}
        className={imageClassName}
        onError={() => setState(getNextProductImageStateOnError(imageValue))}
      />
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
