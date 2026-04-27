export const LIBRARY_BACK_TO_TOP_THRESHOLD = 360;

export function shouldShowLibraryBackToTop(
  scrollTop: number,
  threshold = LIBRARY_BACK_TO_TOP_THRESHOLD,
) {
  return scrollTop > threshold;
}
