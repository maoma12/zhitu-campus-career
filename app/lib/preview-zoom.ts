export const PREVIEW_ZOOM_MIN = 40;
export const PREVIEW_ZOOM_MAX = 160;
export const PREVIEW_ZOOM_STEP = 10;
export const PREVIEW_A4_WIDTH_PX = 610;

export function clampPreviewZoom(value: number) {
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, Math.round(value)));
}

export function stepPreviewZoom(current: number, direction: -1 | 1) {
  return clampPreviewZoom(current + direction * PREVIEW_ZOOM_STEP);
}

export function calculateFitWidthZoom(
  containerWidth: number,
  horizontalPadding: number,
) {
  const availableWidth = Math.max(0, containerWidth - horizontalPadding);
  return clampPreviewZoom((availableWidth / PREVIEW_A4_WIDTH_PX) * 100);
}

export type PreviewZoomState = { zoom: number; fitWidth: boolean };

export function applyManualPreviewZoom(
  state: PreviewZoomState,
  direction: -1 | 1,
): PreviewZoomState {
  return { zoom: stepPreviewZoom(state.zoom, direction), fitWidth: false };
}

export function applyFitWidthZoom(
  state: PreviewZoomState,
  containerWidth: number,
  horizontalPadding: number,
): PreviewZoomState {
  if (!state.fitWidth) return state;
  return {
    zoom: calculateFitWidthZoom(containerWidth, horizontalPadding),
    fitWidth: true,
  };
}
