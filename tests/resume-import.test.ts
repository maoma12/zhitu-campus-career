import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  joinPdfRowItems,
  normalizeOcrText,
  parseResumeText,
  splitResumeEntries,
  validateImportFile,
} from "../app/lib/resume-import.ts";

type Fixture = {
  fixtureLabel: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  target: string;
  summary: string;
  education: string[];
  experience: string[];
  project: string[];
  campus: string[];
  skills: string;
  certificate: string;
  evaluation: string;
  portfolio: string;
};

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/resume-import-fixture.json", import.meta.url),
    "utf8",
  ),
) as Fixture;

function fixtureText() {
  const sections: [string, keyof Fixture][] = [
    ["个人简介", "summary"],
    ["教育经历", "education"],
    ["实习经历", "experience"],
    ["项目经历", "project"],
    ["校园经历", "campus"],
    ["技能特长", "skills"],
    ["证书荣誉", "certificate"],
    ["自我评价", "evaluation"],
    ["作品链接", "portfolio"],
  ];
  const lines = [
    fixture.fixtureLabel,
    `姓名：${fixture.name}`,
    `邮箱：${fixture.email}`,
    `手机：${fixture.phone}`,
    `所在地：${fixture.city}`,
    `求职目标：${fixture.target}`,
    "",
  ];
  for (const [heading, key] of sections) {
    lines.push(heading);
    const value = fixture[key];
    lines.push(Array.isArray(value) ? value.join("\n\n") : value);
    lines.push("");
  }
  return lines.join("\n");
}

test("TEST FIXTURE 标准答案的结构化字段解析完整", () => {
  const parsed = parseResumeText(fixtureText());
  const expected = {
    name: fixture.name,
    email: fixture.email,
    phone: fixture.phone,
    city: fixture.city,
    summary: fixture.summary,
    education: fixture.education.join("\n\n"),
    experience: fixture.experience.join("\n\n"),
    project: fixture.project.join("\n\n"),
    campus: fixture.campus.join("\n\n"),
    skills: fixture.skills,
    certificate: fixture.certificate,
    evaluation: fixture.evaluation,
    portfolio: fixture.portfolio,
  };

  for (const [field, value] of Object.entries(expected)) {
    assert.equal(parsed[field as keyof typeof expected], value, field);
  }
});

test("移动端导入在解码前拒绝过大的文档与图片", () => {
  assert.throws(
    () => validateImportFile({ name: "TEST-FIXTURE.pdf", type: "application/pdf", size: 21 * 1024 * 1024 }),
    /20 MB/,
  );
  assert.throws(
    () => validateImportFile({ name: "TEST-FIXTURE.png", type: "image/png", size: 11 * 1024 * 1024 }),
    /10 MB/,
  );
  assert.doesNotThrow(() =>
    validateImportFile({ name: "TEST-FIXTURE.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 }),
  );
});

test("PDF 字形按视觉间距重组，不在连续中文中插入伪空格", () => {
  assert.equal(
    joinPdfRowItems([
      { str: "技", transform: [10, 0, 0, 10, 0, 0], width: 10 },
      { str: "能", transform: [10, 0, 0, 10, 10, 0], width: 10 },
      { str: "特长", transform: [10, 0, 0, 10, 20, 0], width: 20 },
      { str: "Java", transform: [10, 0, 0, 10, 50, 0], width: 20 },
    ]),
    "技能特长 Java",
  );
});

test("多条经历按空行拆分，导入时不会合并为单条", () => {
  assert.deepEqual(
    splitResumeEntries(fixture.experience.join("\n\n")),
    fixture.experience,
  );
});

test("OCR 连续中文字间伪空格不会破坏标题与字段解析", () => {
  const normalized = normalizeOcrText(
    "姓 名：测 试 甲 同 学\n教 育 经 历\n虚 构 大 学｜软 件 工 程",
  );
  assert.equal(normalized, "姓名：测试甲同学\n教育经历\n虚构大学｜软件工程");
  const parsed = parseResumeText(normalized);
  assert.equal(parsed.name, "测试甲同学");
  assert.equal(parsed.education, "虚构大学｜软件工程");
});
