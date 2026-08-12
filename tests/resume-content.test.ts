import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWorkspaceActivities,
  hasMeaningfulModuleContent,
  isPreviewModuleVisible,
  visiblePreviewModuleKeys,
} from "../app/lib/resume-content.ts";

const baseResume = {
  experiences: [],
  educations: [],
  projects: [],
  campusExperiences: [],
  skills: "",
  certificate: "",
  evaluation: "",
  portfolio: "",
  customModules: [{ id: "custom:test", content: "" }],
  moduleOrder: [
    "basic", "experience", "education", "project", "campus",
    "skills", "certificate", "evaluation", "portfolio", "custom:test",
  ],
  hiddenModules: [],
};

test("空 workspace 不伪造最近动态", () => {
  assert.deepEqual(
    deriveWorkspaceActivities([{ id: "TEST-A", name: "TEST FIXTURE A" }], {}),
    [],
  );
});

test("最近动态只派生当前 workspace 的真实 histories", () => {
  const activities = deriveWorkspaceActivities(
    [{ id: "TEST-A", name: "TEST FIXTURE A" }],
    {
      "TEST-A": [{ id: "A-1", label: "TEST A 版本", createdAt: "2026-08-11 10:00" }],
      "TEST-B": [{ id: "B-1", label: "TEST B 版本", createdAt: "2026-08-12 10:00" }],
    },
  );
  assert.deepEqual(activities.map((item) => item.id), ["A-1"]);
  assert.equal(activities[0].resumeName, "TEST FIXTURE A");
});

test("A/B workspace 动态不会共享", () => {
  const histories = {
    "TEST-A": [{ id: "A-1", label: "TEST A", createdAt: "2026-08-11" }],
    "TEST-B": [{ id: "B-1", label: "TEST B", createdAt: "2026-08-12" }],
  };
  assert.deepEqual(
    deriveWorkspaceActivities([{ id: "TEST-A", name: "A" }], histories).map((item) => item.id),
    ["A-1"],
  );
  assert.deepEqual(
    deriveWorkspaceActivities([{ id: "TEST-B", name: "B" }], histories).map((item) => item.id),
    ["B-1"],
  );
});

test("删除快照或简历后对应动态立即消失", () => {
  const resumes = [{ id: "TEST-A", name: "A" }, { id: "TEST-B", name: "B" }];
  const histories = {
    "TEST-A": [{ id: "A-1", label: "A", createdAt: "2026-08-11" }],
    "TEST-B": [{ id: "B-1", label: "B", createdAt: "2026-08-12" }],
  };
  assert.deepEqual(
    deriveWorkspaceActivities(resumes, { ...histories, "TEST-A": [] }).map((item) => item.id),
    ["B-1"],
  );
  assert.deepEqual(
    deriveWorkspaceActivities([resumes[0]], histories).map((item) => item.id),
    ["A-1"],
  );
});

test("标准模块、custom 与空壳条目的内容判断统一", () => {
  assert.equal(hasMeaningfulModuleContent(baseResume, "basic"), true);
  for (const key of baseResume.moduleOrder.filter((key) => key !== "basic")) {
    assert.equal(hasMeaningfulModuleContent(baseResume, key), false, key);
  }
  assert.equal(
    hasMeaningfulModuleContent({ ...baseResume, experiences: [{ id: "shell" }] }, "experience"),
    false,
  );
  assert.equal(
    hasMeaningfulModuleContent({ ...baseResume, educations: [{ id: "e", school: "虚构大学" }] }, "education"),
    true,
  );
  assert.equal(
    hasMeaningfulModuleContent({ ...baseResume, projects: [{ id: "p", description: "TEST FIXTURE" }] }, "project"),
    true,
  );
  assert.equal(
    hasMeaningfulModuleContent({ ...baseResume, campusExperiences: [{ id: "c", period: "2025.01" }] }, "campus"),
    true,
  );
  for (const key of ["skills", "certificate", "evaluation", "portfolio"]) {
    assert.equal(hasMeaningfulModuleContent({ ...baseResume, [key]: "  " }, key), false);
    assert.equal(hasMeaningfulModuleContent({ ...baseResume, [key]: "TEST FIXTURE" }, key), true);
  }
  assert.equal(
    hasMeaningfulModuleContent({ ...baseResume, customModules: [{ id: "custom:test", content: "TEST FIXTURE" }] }, "custom:test"),
    true,
  );
});

test("手工 hiddenModules 优先，补填出现且清空消失", () => {
  const filled = { ...baseResume, skills: "TEST FIXTURE" };
  assert.equal(isPreviewModuleVisible(filled, "skills"), true);
  assert.deepEqual(visiblePreviewModuleKeys(filled), ["basic", "skills"]);
  assert.equal(isPreviewModuleVisible({ ...filled, hiddenModules: ["skills"] }, "skills"), false);
  assert.deepEqual(visiblePreviewModuleKeys({ ...filled, skills: "   " }), ["basic"]);
});
