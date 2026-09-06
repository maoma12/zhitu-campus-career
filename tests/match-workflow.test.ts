import test from "node:test";
import assert from "node:assert/strict";
import { projectResumeFactPacks, factPacksToAiFacts } from "../app/lib/ai-fact-guard.ts";
import { assessConstraint, buildPriorityMatchItems, filterSuggestionsByReview, isAnalysisBindingCurrent, updateMatchReview } from "../app/lib/match-workflow.ts";
import type { JDConstraint, RequirementEvidence } from "../app/lib/jd-analysis.ts";

const resume = {
  id: "TEST-FIXTURE-resume-phase1",
  basic: { name: "TEST FIXTURE 虚构姓名", phone: "000-TEST", email: "fixture@example.com", city: "虚构市", avatar: "data:test", summary: "不应进入事实包" },
  experiences: [{ id: "exp-1", company: "TEST FIXTURE 星河实验公司", role: "测试实习生", period: "2026.01 - 2026.03", description: "编写自动化测试并复盘缺陷。" }],
  educations: [{ id: "edu-1", school: "TEST FIXTURE 虚构大学", major: "计算机科学", degree: "本科", period: "2023.09 - 2027.06", detail: "2027 年毕业" }],
  projects: [{ id: "project-1", name: "TEST FIXTURE 灯塔项目", role: "开发", period: "2025.01 - 2025.06", stack: "React", description: "实现可访问表单。" }],
  campusExperiences: [{ id: "campus-1", department: "虚构社团", period: "2024.01 - 2024.06", description: "组织测试活动。" }],
  skills: "React · 自动化测试",
  certificate: "TEST FIXTURE 英语六级",
  evaluation: "不会进入事实包",
  portfolio: "https://example.com/not-in-pack",
};

const requirement = (patch: Partial<RequirementEvidence>): RequirementEvidence => ({ id: "testing", label: "自动化测试", kind: "hard", category: "测试", intensity: "must", level: "gap", sources: [], jdSnippet: "必须掌握自动化测试", section: "requirements", strengthSource: "必须", inferred: false, ...patch });
const constraint = (patch: Partial<JDConstraint>): JDConstraint => ({ id: "education", label: "学历要求", jdSnippet: "本科及以上学历", section: "requirements", intensity: "must", inferred: false, ...patch });

test("TEST FIXTURE：事实按条目成包并永久排除个人信息、城市、头像与 URL", () => {
  const packs = projectResumeFactPacks(resume);
  assert.deepEqual(packs.map((item) => item.module), ["experience", "education", "project", "campus", "skills", "certificate"]);
  assert.equal(packs.every((item) => item.factId.startsWith("pack:TEST-FIXTURE-resume-phase1:")), true);
  const text = packs.map((item) => item.summary).join(" ");
  assert.doesNotMatch(text, /虚构姓名|000-TEST|fixture@example\.com|虚构市|data:test|example\.com/);
  assert.equal(factPacksToAiFacts(packs).every((item) => item.field === "fact_pack"), true);
});

test("重点事项按 must 缺口、硬约束、弱证据、普通缺口排序且排除项不输入", () => {
  const packs = projectResumeFactPacks(resume);
  const items = buildPriorityMatchItems([
    requirement({ id: "mentioned-gap", intensity: "mentioned", label: "普通缺口" }),
    requirement({ id: "listed", intensity: "must", level: "listed", label: "仅陈述", sources: ["技能特长"] }),
    requirement({ id: "must-gap", label: "必须缺口" }),
  ], [constraint({ id: "graduation", label: "毕业年份", jdSnippet: "2026 年毕业" })], packs, {}, 5);
  assert.deepEqual(items.map((item) => item.id), ["must-gap", "constraint:graduation:2026 年毕业", "listed", "mentioned-gap"]);
});

test("硬约束四种状态保守可解释，信息不足不等于不满足", () => {
  const packs = projectResumeFactPacks(resume);
  assert.equal(assessConstraint(constraint({}), packs).status, "satisfied");
  assert.equal(assessConstraint(constraint({ jdSnippet: "硕士及以上学历" }), packs).status, "not_satisfied");
  assert.equal(assessConstraint(constraint({ id: "major", label: "专业要求", jdSnippet: "统计学专业" }), packs).status, "insufficient");
  assert.equal(assessConstraint(constraint({ id: "travel", label: "出差要求", jdSnippet: "可以出差" }), packs).status, "not_applicable");
});

test("三种核实状态可撤销，错误匹配会排除绑定建议", () => {
  const inaccurate = updateMatchReview({}, "testing", "inaccurate");
  assert.deepEqual(filterSuggestionsByReview([{ requirementId: "testing" }, { requirementId: "react" }, {}], inaccurate), [{ requirementId: "react" }, {}]);
  const confirmed = updateMatchReview(inaccurate, "testing", "confirmed_gap");
  assert.equal(confirmed.testing, "confirmed_gap");
  assert.deepEqual(updateMatchReview(confirmed, "testing", null), {});
});

test("分析绑定拒绝跨账号、简历、岗位、事实变化与旧代次", () => {
  const binding = { identityGeneration: 7, resumeId: "resume-a", jobTargetId: "job-a", factsFingerprint: "facts-a" };
  assert.equal(isAnalysisBindingCurrent(binding, { ...binding }), true);
  for (const current of [{ ...binding, identityGeneration: 8 }, { ...binding, resumeId: "resume-b" }, { ...binding, jobTargetId: "job-b" }, { ...binding, factsFingerprint: "facts-b" }]) assert.equal(isAnalysisBindingCurrent(binding, current), false);
});
