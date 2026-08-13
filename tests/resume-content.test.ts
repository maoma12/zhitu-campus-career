import assert from "node:assert/strict";
import test from "node:test";

import {
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
