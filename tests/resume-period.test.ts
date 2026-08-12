import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatResumePeriod,
  parseResumePeriod,
  validateMonthRange,
} from "../app/lib/resume-period.ts";

test("解析常见中英文月份范围与至今", () => {
  for (const value of [
    "2024.01 - 2024.06", "2024-01 至 2024-06", "2024/01 — 2024/06",
    "2024年01月 - 2024年06月",
  ]) {
    assert.deepEqual(parseResumePeriod(value), {
      parsed: true, startMonth: "2024-01", endMonth: "2024-06", present: false, original: value,
    });
  }
  for (const value of ["2024.01 - 至今", "2024/01 - present", "2024年01月 至 现在"]) {
    const result = parseResumePeriod(value);
    assert.equal(result.parsed, true);
    if (result.parsed) assert.equal(result.present, true);
  }
});

test("相同月份、未来月份允许，反向范围拒绝", () => {
  assert.equal(validateMonthRange("2027-06", "2027-06", false), "");
  assert.equal(validateMonthRange("2026-09", "2027-06", false), "");
  assert.equal(validateMonthRange("2026-09", "2026-08", false), "结束月份不能早于开始月份");
});

test("无法可靠解析时原样保留，明确选择后才标准化", () => {
  assert.deepEqual(parseResumePeriod("大二暑假（TEST FIXTURE）"), {
    parsed: false,
    original: "大二暑假（TEST FIXTURE）",
  });
  assert.equal(formatResumePeriod("2025-01", "2025-03", false), "2025.01 - 2025.03");
  assert.equal(formatResumePeriod("2025-01", "", true), "2025.01 - 至今");
  assert.equal(formatResumePeriod("", "2025-03", false), "");
});

test("四类 period 编辑入口统一使用 MonthRangePicker", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/<MonthRangePicker/g) ?? []).length, 4);
  assert.match(source, /closest\("fieldset"\)/);
  assert.match(source, /querySelectorAll<HTMLInputElement>/);
  assert.doesNotMatch(source, /<Field label="(?:项目)?时间"/);
});
