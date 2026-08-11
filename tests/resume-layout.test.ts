import assert from "node:assert/strict";
import test from "node:test";

import {
  decideSmartLayout,
  effectiveResumeDensity,
  normalizeResumeFontSize,
  RESUME_FONT_SIZE_OPTIONS,
} from "../app/lib/resume-layout.ts";

test("关闭智能一页时共享预览始终使用 normal", () => {
  assert.equal(effectiveResumeDensity(false, "relaxed"), "normal");
  assert.equal(effectiveResumeDensity(false, "compact"), "normal");
  assert.equal(effectiveResumeDensity(false, "ultra"), "normal");
  assert.equal(effectiveResumeDensity(true, "relaxed"), "relaxed");
});

test("正文字号选项严格为 5/6/7/8/9，历史 10/12 安全归一化为 9", () => {
  assert.deepEqual(RESUME_FONT_SIZE_OPTIONS, [5, 6, 7, 8, 9]);
  assert.equal(normalizeResumeFontSize(5), 5);
  assert.equal(normalizeResumeFontSize(8), 8);
  assert.equal(normalizeResumeFontSize(10), 9);
  assert.equal(normalizeResumeFontSize(12), 9);
  assert.equal(normalizeResumeFontSize(99), 9);
  assert.equal(normalizeResumeFontSize(undefined), 9);
});

test("短内容从 normal 进入 relaxed 并稳定在一页", () => {
  const relaxed = decideSmartLayout({
    density: "normal",
    fitsOnePage: true,
    fillRatio: 0.55,
    relaxedRejected: false,
    exhausted: false,
  });
  assert.equal(relaxed.density, "relaxed");
  assert.deepEqual(
    decideSmartLayout({
      ...relaxed,
      density: "relaxed",
      fitsOnePage: true,
      fillRatio: 0.7,
    }),
    relaxed,
  );
});

test("正常内容自然一页时保持 normal", () => {
  assert.equal(
    decideSmartLayout({
      density: "normal",
      fitsOnePage: true,
      fillRatio: 0.82,
      relaxedRejected: false,
      exhausted: false,
    }).density,
    "normal",
  );
});

test("略超内容按 normal→compact→ultra 收敛", () => {
  const compact = decideSmartLayout({
    density: "normal",
    fitsOnePage: false,
    fillRatio: 1.05,
    relaxedRejected: false,
    exhausted: false,
  });
  assert.equal(compact.density, "compact");
  const ultra = decideSmartLayout({
    ...compact,
    density: "compact",
    fitsOnePage: false,
    fillRatio: 1.01,
  });
  assert.equal(ultra.density, "ultra");
  assert.equal(
    decideSmartLayout({
      ...ultra,
      density: "ultra",
      fitsOnePage: true,
      fillRatio: 0.98,
    }).density,
    "ultra",
  );
});

test("ultra 仍超时回 compact 正常分页且不再振荡", () => {
  const fallback = decideSmartLayout({
    density: "ultra",
    fitsOnePage: false,
    fillRatio: 1.2,
    relaxedRejected: false,
    exhausted: false,
  });
  assert.deepEqual(fallback, {
    density: "compact",
    relaxedRejected: true,
    exhausted: true,
  });
  assert.deepEqual(
    decideSmartLayout({
      ...fallback,
      fitsOnePage: false,
      fillRatio: 1.25,
    }),
    fallback,
  );
});

test("内容减少后的新测量代次可恢复 relaxed 或 normal", () => {
  assert.equal(
    decideSmartLayout({
      density: "normal",
      fitsOnePage: true,
      fillRatio: 0.6,
      relaxedRejected: false,
      exhausted: false,
    }).density,
    "relaxed",
  );
  assert.equal(
    decideSmartLayout({
      density: "normal",
      fitsOnePage: true,
      fillRatio: 0.85,
      relaxedRejected: false,
      exhausted: false,
    }).density,
    "normal",
  );
});

test("relaxed 放不下时拒绝本代再次进入，避免 relaxed↔normal 振荡", () => {
  const rejected = decideSmartLayout({
    density: "relaxed",
    fitsOnePage: false,
    fillRatio: 1.01,
    relaxedRejected: false,
    exhausted: false,
  });
  assert.deepEqual(rejected, {
    density: "normal",
    relaxedRejected: true,
    exhausted: false,
  });
  assert.equal(
    decideSmartLayout({
      ...rejected,
      fitsOnePage: true,
      fillRatio: 0.68,
    }).density,
    "normal",
  );
});
