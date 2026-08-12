import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  applyFitWidthZoom,
  applyManualPreviewZoom,
  calculateFitWidthZoom,
  clampPreviewZoom,
  stepPreviewZoom,
} from "../app/lib/preview-zoom.ts";

test("预览缩放步长和上下界稳定", () => {
  assert.equal(stepPreviewZoom(80, 1), 90);
  assert.equal(stepPreviewZoom(80, -1), 70);
  assert.equal(clampPreviewZoom(5), PREVIEW_ZOOM_MIN);
  assert.equal(clampPreviewZoom(999), PREVIEW_ZOOM_MAX);
});

test("适应宽度按容器可用宽度计算并 clamp", () => {
  assert.equal(calculateFitWidthZoom(654, 44), 100);
  assert.equal(calculateFitWidthZoom(300, 44), 42);
  assert.equal(calculateFitWidthZoom(2000, 44), PREVIEW_ZOOM_MAX);
});

test("手动缩放退出适宽，ResizeObserver 更新只在适宽模式生效", () => {
  const manual = applyManualPreviewZoom({ zoom: 80, fitWidth: true }, 1);
  assert.deepEqual(manual, { zoom: 90, fitWidth: false });
  assert.deepEqual(applyFitWidthZoom(manual, 654, 44), manual);
  assert.deepEqual(
    applyFitWidthZoom({ zoom: 80, fitWidth: true }, 654, 44),
    { zoom: 100, fitWidth: true },
  );
});
