import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeKeywordCoverage,
  type EvidenceSection,
  type KeywordRule,
} from "../app/lib/jd-analysis.ts";

const rules: KeywordRule[] = [
  { label: "Java", aliases: ["java"] },
  { label: "MySQL", aliases: ["mysql"] },
  { label: "Git", aliases: ["git"] },
  { label: "Redis", aliases: ["redis"] },
];

// TEST FIXTURE：以下内容完全虚构，不对应任何真人或真实招聘岗位。
const fixtureResume: EvidenceSection[] = [
  {
    label: "项目经历",
    level: "experience",
    text: "TEST FIXTURE：使用 Java 与 MySQL 完成虚构课程项目。",
  },
  {
    label: "技能特长",
    level: "listed",
    text: "TEST FIXTURE：Git",
  },
];

test("高、中、低相关虚构 JD 的关键词覆盖排序稳定", () => {
  const high = analyzeKeywordCoverage(
    "TEST FIXTURE 高相关 JD：Java、MySQL、Git",
    rules,
    fixtureResume,
  );
  const medium = analyzeKeywordCoverage(
    "TEST FIXTURE 中相关 JD：Java、Redis",
    rules,
    fixtureResume,
  );
  const low = analyzeKeywordCoverage(
    "TEST FIXTURE 低相关 JD：Redis",
    rules,
    fixtureResume,
  );

  assert.ok(high.coverageRatio > medium.coverageRatio);
  assert.ok(medium.coverageRatio > low.coverageRatio);
});

test("经历证据优先于技能陈述，缺失项不伪造证据", () => {
  const result = analyzeKeywordCoverage(
    "TEST FIXTURE JD：Java、Git、Redis",
    rules,
    fixtureResume,
  );

  assert.deepEqual(result.evidence, [
    { keyword: "Java", level: "experience", sources: ["项目经历"] },
    { keyword: "Git", level: "listed", sources: ["技能特长"] },
  ]);
  assert.deepEqual(result.missing, ["Redis"]);
});
