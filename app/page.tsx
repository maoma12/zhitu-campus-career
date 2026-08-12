"use client";

/* eslint-disable @next/next/no-img-element -- Blob URLs are the exact JPEG pages embedded in the exported PDF. */

import {
  ChangeEvent,
  RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AuthSession,
  SESSION_STORAGE_KEY,
  cloudConfigured,
  consumeAuthRedirect,
  getSession,
  loadWorkspace,
  saveWorkspace,
  signInWithPassword,
  signOut,
  signUpWithPassword,
} from "./lib/supabase-client";
import {
  extractResumeText,
  parseResumeText,
  ParsedResumeText,
  splitResumeEntries,
} from "./lib/resume-import";
import {
  ANONYMOUS_WORKSPACE_KEY,
  IdentityEpoch,
  LEGACY_SHARED_WORKSPACE_KEYS,
  accountWorkspaceKey,
  advanceIdentityEpoch,
  isCurrentIdentity,
  removeCurrentResumeSnapshot,
  removeResumeFromWorkspace,
  resolveAuthenticatedWorkspace,
} from "./lib/workspace-security";
import {
  analyzeKeywordCoverage,
  KeywordCoverageResult,
} from "./lib/jd-analysis";
import {
  decideSmartLayout,
  effectiveResumeDensity,
  normalizeResumeFontSize,
  normalizeResumeHeadingFontSize,
  RESUME_FONT_SIZE_OPTIONS,
  RESUME_HEADING_FONT_SIZE_OPTIONS,
  ResumeDensity,
  ResumeFontSize,
  ResumeHeadingFontSize,
} from "./lib/resume-layout";
import {
  deriveWorkspaceActivities,
  isMeaningfulResumeEntry,
  isPreviewModuleVisible,
  visiblePreviewModuleKeys,
} from "./lib/resume-content";
import {
  formatResumePeriod,
  parseResumePeriod,
  validateMonthRange,
} from "./lib/resume-period";
import {
  PREVIEW_A4_WIDTH_PX,
  PREVIEW_ZOOM_MAX,
  PREVIEW_ZOOM_MIN,
  applyManualPreviewZoom,
  calculateFitWidthZoom,
} from "./lib/preview-zoom";

type View = "dashboard" | "editor" | "jd" | "optimize";
type Template = "classic" | "azure" | "sidebar";
type StandardModuleKey =
  | "basic"
  | "experience"
  | "education"
  | "project"
  | "campus"
  | "skills"
  | "certificate"
  | "evaluation"
  | "portfolio";
type CustomModuleKey = `custom:${string}`;
type ModuleKey = StandardModuleKey | CustomModuleKey;

type CustomModule = {
  id: CustomModuleKey;
  title: string;
  content: string;
};

type Experience = {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
};

type Education = {
  id: string;
  school: string;
  major: string;
  degree: string;
  period: string;
  detail: string;
};

type Project = {
  id: string;
  name: string;
  role: string;
  period: string;
  stack: string;
  description: string;
};

type CampusExperience = {
  id: string;
  department: string;
  period: string;
  description: string;
};

type EntryCollection =
  | "experiences"
  | "educations"
  | "projects"
  | "campusExperiences";

type Resume = {
  id: string;
  name: string;
  target: string;
  fontSize: ResumeFontSize;
  headingFontSize: ResumeHeadingFontSize;
  updated: string;
  completion: number;
  version: number;
  basic: {
    name: string;
    phone: string;
    email: string;
    city: string;
    target: string;
    summary: string;
    avatar: string;
  };
  experiences: Experience[];
  educations: Education[];
  projects: Project[];
  campusExperiences: CampusExperience[];
  skills: string;
  certificate: string;
  evaluation: string;
  portfolio: string;
  moduleLabels: Partial<Record<StandardModuleKey, string>>;
  customModules: CustomModule[];
  moduleOrder: ModuleKey[];
  hiddenModules: ModuleKey[];
};

type ResumeSnapshot = {
  id: string;
  label: string;
  createdAt: string;
  resume: Resume;
};

type ResumeHistory = Record<string, ResumeSnapshot[]>;

type StoredWorkspace = {
  resumes: Resume[];
  currentId: string;
  template: Template;
  histories: ResumeHistory;
};

type Suggestion = {
  id: number;
  module: string;
  kind: string;
  keyword: string;
  original: string;
  optimized: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  safe: boolean;
  applyTo?: "skills" | "summary" | "experience" | "project";
  targetId?: string;
};

type JDAnalysisResult = KeywordCoverageResult & {
  questions: [string, string, string][];
};

const moduleMeta: Record<StandardModuleKey, { label: string; icon: string }> = {
  basic: { label: "基本信息", icon: "人" },
  experience: { label: "实习经历", icon: "历" },
  education: { label: "教育经历", icon: "学" },
  project: { label: "项目经历", icon: "项" },
  campus: { label: "校园经历", icon: "校" },
  skills: { label: "技能特长", icon: "技" },
  certificate: { label: "证书荣誉", icon: "证" },
  evaluation: { label: "自我评价", icon: "评" },
  portfolio: { label: "作品展示", icon: "链" },
};

const defaultOrder: StandardModuleKey[] = [
  "basic",
  "experience",
  "education",
  "project",
  "campus",
  "skills",
  "certificate",
  "evaluation",
  "portfolio",
];

function isStandardModuleKey(key: ModuleKey): key is StandardModuleKey {
  return defaultOrder.includes(key as StandardModuleKey);
}

function moduleLabel(resume: Resume, key: ModuleKey) {
  if (isStandardModuleKey(key)) {
    return resume.moduleLabels[key]?.trim() || moduleMeta[key].label;
  }
  return (
    resume.customModules.find((item) => item.id === key)?.title.trim() ||
    "自定义模块"
  );
}

function moduleIcon(key: ModuleKey) {
  return isStandardModuleKey(key) ? moduleMeta[key].icon : "自";
}

const seedResume: Resume = {
  id: "resume-main",
  name: "Java 后端开发校招简历",
  target: "Java 后端开发实习生",
  fontSize: 9,
  headingFontSize: 10,
  updated: "刚刚",
  completion: 88,
  version: 3,
  basic: {
    name: "陈锚炀",
    phone: "150 1729 4882",
    email: "2687922667@qq.com",
    city: "深圳",
    target: "Java 后端开发实习生",
    summary:
      "通信工程专业本科生，具备 Java、SQL 与数据结构基础，有产品需求分析和软硬件协同项目经验。",
    avatar: "",
  },
  experiences: [{
    id: "experience-seed",
    company: "顺丰速运集团",
    role: "助理产品经理 · 产业园信息化组",
    period: "2026.01 — 2026.04",
    description:
      "负责园区人员轨迹数据整理与日报输出，基于用户反馈梳理定位、排班与告警需求；协同研发团队推进需求评审、版本迭代与上线验收。",
  }],
  educations: [{
    id: "education-seed",
    school: "深圳大学",
    major: "通信工程 · 电子与信息工程学院",
    degree: "本科 · 全日制",
    period: "2023.09 — 2027.06",
    detail:
      "GPA 3.45/4.5，专业前 30%；核心课程：数据结构（92）、面向对象程序设计（88）、计算机网络。",
  }],
  projects: [{
    id: "project-seed",
    name: "无人机物流调度管理系统",
    role: "核心开发",
    period: "2025.11 — 2026.12",
    stack: "C++ · OOP · Cursor",
    description:
      "完成多文件 C++ 项目结构设计，基于继承与派生类实现任务分发、订单分配和本地数据持久化；独立设计控制台交互流程。",
  }],
  campusExperiences: [{
    id: "campus-seed",
    department: "",
    period: "",
    description: "",
  }],
  skills:
    "Java · C/C++ · SQL · 数据结构 · Git · 墨刀 · Excel · 英语六级",
  certificate: "全国大学生电子设计竞赛校级一等奖 · 大学英语六级",
  evaluation:
    "逻辑清晰，能够从用户问题中拆解需求并协同推进落地；保持对技术实现的好奇心和持续学习习惯。",
  portfolio: "GitHub · github.com/chen-maoyang  ｜  作品集 · portfolio.example.com",
  moduleLabels: {},
  customModules: [],
  moduleOrder: defaultOrder,
  hiddenModules: [],
};

const blankResume: Resume = {
  id: "resume-blank",
  name: "我的第一份简历",
  target: "",
  fontSize: 9,
  headingFontSize: 10,
  updated: "刚刚",
  completion: 10,
  version: 1,
  basic: {
    name: "",
    phone: "",
    email: "",
    city: "",
    target: "",
    summary: "",
    avatar: "",
  },
  experiences: [],
  educations: [],
  projects: [],
  campusExperiences: [{
    id: "campus-blank",
    department: "",
    period: "",
    description: "",
  }],
  skills: "",
  certificate: "",
  evaluation: "",
  portfolio: "",
  moduleLabels: {},
  customModules: [],
  moduleOrder: defaultOrder,
  hiddenModules: [],
};

const initialSuggestions: Suggestion[] = [
  {
    id: 1,
    module: "实习经历",
    kind: "成果前置",
    keyword: "数据分析",
    original:
      "负责园区人员轨迹数据整理与日报输出，基于用户反馈梳理定位、排班与告警需求。",
    optimized:
      "围绕园区人员轨迹场景，整理业务数据并输出日报；结合用户反馈梳理定位、排班与告警需求，为需求评审提供依据。",
    reason: "保留原有事实，将业务场景、动作和产出按阅读顺序重组。",
    status: "pending",
    safe: true,
  },
  {
    id: 2,
    module: "项目经历",
    kind: "关键词强化",
    keyword: "面向对象",
    original:
      "基于继承与派生类实现任务分发、订单分配和本地数据持久化。",
    optimized:
      "运用面向对象设计方法，以继承与派生类完成任务分发、订单分配及本地数据持久化。",
    reason: "强化简历中已经存在、且与 JD 相关的面向对象能力。",
    status: "pending",
    safe: true,
  },
  {
    id: 3,
    module: "技能特长",
    kind: "结构调整",
    keyword: "Java / SQL",
    original: "Java · C/C++ · SQL · 数据结构 · Git · 墨刀 · Excel",
    optimized: "开发基础：Java · SQL · 数据结构 · Git\n其他工具：C/C++ · 墨刀 · Excel",
    reason: "将目标岗位相关技能优先展示，不新增技能。",
    status: "pending",
    safe: true,
  },
  {
    id: 4,
    module: "实习经历",
    kind: "信息补充",
    keyword: "量化结果",
    original: "协同研发团队推进需求评审、版本迭代与上线验收。",
    optimized:
      "协同【团队角色】推进【版本数量】次需求评审、版本迭代与上线验收，最终实现【真实结果】。",
    reason: "原文缺少可验证的规模和结果，需要你补充真实信息后才能使用。",
    status: "pending",
    safe: false,
  },
];

const jdSample = `Java 后端开发实习生

岗位职责：
1. 参与业务系统后端功能开发、接口设计与单元测试；
2. 配合产品与测试完成需求分析、问题定位和版本迭代；
3. 参与数据库表设计及性能优化。

任职要求：
1. 计算机相关专业本科及以上学历；
2. 熟悉 Java 基础、面向对象编程与常用集合；
3. 了解 Spring Boot、MySQL、Git；
4. 掌握数据结构、TCP/IP 等计算机基础；
5. 具备良好的沟通能力和学习能力。`;

const jdKeywordRules = [
  { label: "Java", aliases: ["java"], question: "请说明 Java 面向对象的核心特性，并结合项目举例。" },
  { label: "Spring Boot", aliases: ["spring boot", "springboot"], question: "请介绍 Spring Boot 自动配置的基本原理。" },
  { label: "MySQL", aliases: ["mysql"], question: "请说明常用索引类型以及索引失效的场景。" },
  { label: "SQL", aliases: ["sql", "数据库"], question: "如果数据量增长，你会如何分析和优化一条慢查询？" },
  { label: "Git", aliases: ["git"], question: "团队协作中你如何处理 Git 分支冲突？" },
  { label: "数据结构", aliases: ["数据结构", "data structure"], question: "请比较数组、链表和哈希表的适用场景。" },
  { label: "TCP/IP", aliases: ["tcp/ip", "tcp", "计算机网络"], question: "请说明 TCP 三次握手和四次挥手的过程。" },
  { label: "Linux", aliases: ["linux"], question: "你常用哪些 Linux 命令排查进程或网络问题？" },
  { label: "Redis", aliases: ["redis"], question: "请说明 Redis 常见数据结构及其适用场景。" },
  { label: "Python", aliases: ["python"], question: "请介绍你用 Python 完成过的一个具体任务。" },
  { label: "C/C++", aliases: ["c++", "c/c++"], question: "请说明 C++ 中继承与多态的实现方式。" },
  { label: "React", aliases: ["react"], question: "请说明 React 状态更新与组件渲染之间的关系。" },
  { label: "Vue", aliases: ["vue"], question: "请介绍 Vue 响应式系统的基本思路。" },
  { label: "沟通协作", aliases: ["沟通", "协作", "团队合作"], question: "请举例说明你如何协调不同角色推进一项任务。" },
  { label: "学习能力", aliases: ["学习能力", "快速学习"], question: "请举例说明你如何在短时间内掌握一项新技能。" },
];

function analyzeWithRules(jd: string, resume: Resume): JDAnalysisResult {
  const sections = [
    {
      label: "实习经历",
      level: "experience" as const,
      text: resume.experiences
        .map((item) => `${item.company} ${item.role} ${item.description}`)
        .join("\n"),
    },
    {
      label: "项目经历",
      level: "experience" as const,
      text: resume.projects
        .map((item) => `${item.name} ${item.role} ${item.stack} ${item.description}`)
        .join("\n"),
    },
    {
      label: "教育经历",
      level: "experience" as const,
      text: resume.educations
        .map((item) => `${item.school} ${item.major} ${item.degree} ${item.detail}`)
        .join("\n"),
    },
    {
      label: "校园经历",
      level: "experience" as const,
      text: resume.campusExperiences
        .map((item) => `${item.department} ${item.description}`)
        .join("\n"),
    },
    {
      label: "技能特长",
      level: "listed" as const,
      text: resume.skills,
    },
    {
      label: "个人简介/求职目标",
      level: "listed" as const,
      text: `${resume.target} ${resume.basic.target} ${resume.basic.summary}`,
    },
    {
      label: "证书与其他陈述",
      level: "listed" as const,
      text: `${resume.certificate} ${resume.evaluation} ${resume.portfolio}`,
    },
  ];
  const coverage = analyzeKeywordCoverage(jd, jdKeywordRules, sections);
  const selected = jdKeywordRules.filter((rule) =>
    coverage.keywords.includes(rule.label),
  );
  const questions: [string, string, string][] = selected.slice(0, 7).map((rule) => [
    coverage.missing.includes(rule.label) ? "待补充能力" : "岗位重点",
    rule.question,
    `来源：JD 关键词「${rule.label}」`,
  ]);
  if (questions.length < 5) {
    questions.push(
      ["项目深挖", "请选择一个最能代表你的项目，说明背景、个人任务、行动和结果。", "来源：简历项目经历"],
      ["行为面试", "请举例说明你遇到困难后如何定位问题并推动解决。", "来源：通用校招面试"],
    );
  }
  return {
    ...coverage,
    questions: questions.slice(0, 8),
  };
}

function buildRuleSuggestions(
  resume: Resume,
  analysis: JDAnalysisResult,
): Suggestion[] {
  const skillParts = resume.skills
    .split(/[·,，、|｜\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const priority = (value: string) =>
    analysis.matched.some((keyword) =>
      value.toLowerCase().includes(keyword.toLowerCase()),
    )
      ? 0
      : 1;
  const orderedSkills = [...skillParts]
    .sort((a, b) => priority(a) - priority(b))
    .join(" · ");
  const experience = resume.experiences[0];
  const project = resume.projects[0];
  const suggestions: Suggestion[] = [];

  if (resume.skills && orderedSkills !== resume.skills) {
    suggestions.push({
      id: suggestions.length + 1,
      module: "技能特长",
      kind: "岗位相关项前置",
      keyword: analysis.matched.slice(0, 3).join(" / ") || "技能排序",
      original: resume.skills,
      optimized: orderedSkills,
      reason: "仅调整已有技能的展示顺序，不添加新技能。",
      status: "pending",
      safe: true,
      applyTo: "skills",
    });
  }

  if (resume.basic.summary && resume.basic.target) {
    const optimized = `${resume.basic.target}方向；${resume.basic.summary}`
      .replace(/[；;]{2,}/g, "；")
      .trim();
    if (optimized !== resume.basic.summary) {
      suggestions.push({
        id: suggestions.length + 1,
        module: "个人简介",
        kind: "求职方向前置",
        keyword: resume.basic.target,
        original: resume.basic.summary,
        optimized,
        reason: "将简历中已经填写的求职目标前置，保留原简介事实。",
        status: "pending",
        safe: true,
        applyTo: "summary",
      });
    }
  }

  if (experience?.description) {
    const optimized = experience.description
      .split(/[；;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join("；");
    suggestions.push({
      id: suggestions.length + 1,
      module: "实习经历",
      kind: "长句拆分",
      keyword: analysis.matched[0] ?? "经历表达",
      original: experience.description,
      optimized,
      reason: "仅整理原有句子和标点，不修改时间、职责或结果。",
      status: "pending",
      safe: true,
      applyTo: "experience",
      targetId: experience.id,
    });
  }

  if (project?.description) {
    suggestions.push({
      id: suggestions.length + 1,
      module: "项目经历",
      kind: "贡献表达检查",
      keyword: analysis.matched.find((item) =>
        project.description.toLowerCase().includes(item.toLowerCase()),
      ) ?? "项目贡献",
      original: project.description,
      optimized: project.description,
      reason: "当前规则未发现可安全自动改写的内容，建议人工确认个人贡献和结果是否清晰。",
      status: "pending",
      safe: true,
      applyTo: "project",
      targetId: project.id,
    });
  }

  suggestions.push({
    id: suggestions.length + 1,
    module: "缺失项",
    kind: "需要真实信息",
    keyword: analysis.missing.slice(0, 3).join(" / ") || "量化结果",
    original: "简历当前未提供对应证据。",
    optimized: "如你确实具备相关经历，请手动补充真实场景、行动和结果。",
    reason: "规则不会把 JD 中的缺失技能直接写入简历。",
    status: "pending",
    safe: false,
  });

  return suggestions;
}

function storageTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function cloneResume(resume: Resume): Resume {
  return JSON.parse(JSON.stringify(resume)) as Resume;
}

function createCleanWorkspace(): StoredWorkspace {
  return {
    resumes: [cloneResume(blankResume)],
    currentId: blankResume.id,
    template: "classic",
    histories: {},
  };
}

function readLocalWorkspace(key: string): unknown | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeModuleList(
  value: unknown,
  fallback: ModuleKey[],
  customIds: CustomModuleKey[] = [],
) {
  if (!Array.isArray(value)) return [...fallback];
  const allowed = new Set<ModuleKey>([...defaultOrder, ...customIds]);
  const result = value.filter(
    (item): item is ModuleKey =>
      typeof item === "string" && allowed.has(item as ModuleKey),
  );
  return Array.from(new Set(result));
}

function normalizeResume(value: unknown): Resume {
  const safeValue = isRecord(value) ? value : {};
  const safeBasic = isRecord(safeValue.basic) ? safeValue.basic : {};
  const legacyExperience = isRecord(safeValue.experience)
    ? safeValue.experience
    : null;
  const legacyEducation = isRecord(safeValue.education)
    ? safeValue.education
    : null;
  const legacyProject = isRecord(safeValue.project) ? safeValue.project : null;

  const normalizeExperience = (item: unknown, index: number): Experience => {
    const source = isRecord(item) ? item : {};
    return {
      id: safeString(source.id) || `experience-${Date.now()}-${index}`,
      company: safeString(source.company),
      role: safeString(source.role),
      period: safeString(source.period),
      description: safeString(source.description),
    };
  };
  const normalizeEducation = (item: unknown, index: number): Education => {
    const source = isRecord(item) ? item : {};
    return {
      id: safeString(source.id) || `education-${Date.now()}-${index}`,
      school: safeString(source.school),
      major: safeString(source.major),
      degree: safeString(source.degree),
      period: safeString(source.period),
      detail: safeString(source.detail),
    };
  };
  const normalizeProject = (item: unknown, index: number): Project => {
    const source = isRecord(item) ? item : {};
    return {
      id: safeString(source.id) || `project-${Date.now()}-${index}`,
      name: safeString(source.name),
      role: safeString(source.role),
      period: safeString(source.period),
      stack: safeString(source.stack),
      description: safeString(source.description),
    };
  };
  const normalizeCampusExperience = (
    item: unknown,
    index: number,
  ): CampusExperience => {
    const source = isRecord(item) ? item : {};
    return {
      id: safeString(source.id) || `campus-${Date.now()}-${index}`,
      department: safeString(source.department),
      period: safeString(source.period),
      description: safeString(source.description),
    };
  };

  const customModules: CustomModule[] = Array.isArray(safeValue.customModules)
    ? safeValue.customModules
        .filter(isRecord)
        .map((item, index) => {
          const rawId = safeString(item.id);
          const id = (
            rawId.startsWith("custom:")
              ? rawId
              : `custom:${Date.now()}-${index}`
          ) as CustomModuleKey;
          return {
            id,
            title: safeString(item.title, `自定义模块 ${index + 1}`),
            content: safeString(item.content),
          };
        })
    : [];
  const customIds = customModules.map((item) => item.id);

  const moduleOrder = normalizeModuleList(
    safeValue.moduleOrder,
    defaultOrder,
    customIds,
  );
  if (!moduleOrder.includes("campus")) {
    const projectIndex = moduleOrder.indexOf("project");
    moduleOrder.splice(projectIndex >= 0 ? projectIndex + 1 : moduleOrder.length, 0, "campus");
  } else if (
    moduleOrder.indexOf("campus") === moduleOrder.length - 1 &&
    moduleOrder.indexOf("project") >= 0
  ) {
    moduleOrder.splice(moduleOrder.indexOf("campus"), 1);
    moduleOrder.splice(moduleOrder.indexOf("project") + 1, 0, "campus");
  }
  defaultOrder.forEach((key) => {
    if (!moduleOrder.includes(key)) moduleOrder.push(key);
  });
  customIds.forEach((key) => {
    if (!moduleOrder.includes(key)) moduleOrder.push(key);
  });
  const rawLabels = isRecord(safeValue.moduleLabels)
    ? safeValue.moduleLabels
    : {};
  const moduleLabels = Object.fromEntries(
    defaultOrder
      .map((key) => [key, safeString(rawLabels[key]).trim()] as const)
      .filter(([, value]) => Boolean(value)),
  ) as Partial<Record<StandardModuleKey, string>>;

  return {
    id: safeString(safeValue.id) || `resume-${Date.now()}`,
    name: safeString(safeValue.name, blankResume.name),
    target: safeString(safeValue.target),
    fontSize: normalizeResumeFontSize(safeValue.fontSize),
    headingFontSize: normalizeResumeHeadingFontSize(
      safeValue.headingFontSize,
    ),
    updated: safeString(safeValue.updated, "刚刚"),
    completion: Math.max(
      0,
      Math.min(100, safeNumber(safeValue.completion, 0)),
    ),
    version: Math.max(1, Math.floor(safeNumber(safeValue.version, 1))),
    basic: {
      name: safeString(safeBasic.name),
      phone: safeString(safeBasic.phone),
      email: safeString(safeBasic.email),
      city: safeString(safeBasic.city),
      target: safeString(safeBasic.target, safeString(safeValue.target)),
      summary: safeString(safeBasic.summary),
      avatar: safeString(safeBasic.avatar),
    },
    experiences: Array.isArray(safeValue.experiences)
      ? safeValue.experiences.map(normalizeExperience)
      : legacyExperience
        ? [normalizeExperience(legacyExperience, 0)]
        : [],
    educations: Array.isArray(safeValue.educations)
      ? safeValue.educations.map(normalizeEducation)
      : legacyEducation
        ? [normalizeEducation(legacyEducation, 0)]
        : [],
    projects: Array.isArray(safeValue.projects)
      ? safeValue.projects.map(normalizeProject)
      : legacyProject
        ? [normalizeProject(legacyProject, 0)]
        : [],
    campusExperiences:
      Array.isArray(safeValue.campusExperiences) &&
      safeValue.campusExperiences.length
      ? safeValue.campusExperiences.map(normalizeCampusExperience)
      : [{
          id: `campus-${Date.now()}`,
          department: "",
          period: "",
          description: "",
        }],
    skills: safeString(safeValue.skills),
    certificate: safeString(safeValue.certificate),
    evaluation: safeString(safeValue.evaluation),
    portfolio: safeString(safeValue.portfolio),
    moduleLabels,
    customModules,
    moduleOrder,
    hiddenModules: normalizeModuleList(safeValue.hiddenModules, [], customIds),
  };
}

function snapshotTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function createUniqueId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

type ExportSection = { heading: string; lines: string[] };

type FormattedSegment = {
  text: string;
  bold: boolean;
};

function formattedSegments(value: string): FormattedSegment[] {
  const segments: FormattedSegment[] = [];
  const pattern = /\*\*([\s\S]*?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      segments.push({ text: value.slice(cursor, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    segments.push({ text: value.slice(cursor), bold: false });
  }
  return segments.length ? segments : [{ text: value, bold: false }];
}

// 保留给后续重新启用的文本型导出流程。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function plainFormattedText(value: string) {
  return formattedSegments(value)
    .map((segment) => segment.text)
    .join("");
}

function FormattedText({ value }: { value: string }) {
  return (
    <>
      {formattedSegments(value).map((segment, index) =>
        segment.bold ? (
          <strong key={`${index}-${segment.text}`}>{segment.text}</strong>
        ) : (
          <span key={`${index}-${segment.text}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function resumeExportSections(resume: Resume): ExportSection[] {
  const sections: ExportSection[] = [];
  resume.moduleOrder
    .filter((key) => key !== "basic" && isPreviewModuleVisible(resume, key))
    .forEach((key) => {
      if (key === "experience" && resume.experiences.length) {
        sections.push({
          heading: moduleLabel(resume, key),
          lines: resume.experiences.filter(isMeaningfulResumeEntry).flatMap((item) => [
            `${item.company}｜${item.role}｜${item.period}`,
            item.description,
          ]),
        });
      } else if (key === "education" && resume.educations.length) {
        sections.push({
          heading: moduleLabel(resume, key),
          lines: resume.educations.filter(isMeaningfulResumeEntry).flatMap((item) => [
            `${item.school}｜${item.major}｜${item.degree}｜${item.period}`,
            item.detail,
          ]),
        });
      } else if (key === "project" && resume.projects.length) {
        sections.push({
          heading: moduleLabel(resume, key),
          lines: resume.projects.filter(isMeaningfulResumeEntry).flatMap((item) => [
            `${item.name}｜${item.role}｜${item.period}`,
            item.stack ? `技术栈：${item.stack}` : "",
            item.description,
          ]),
        });
      } else if (key === "campus" && resume.campusExperiences.length) {
        sections.push({
          heading: moduleLabel(resume, key),
          lines: resume.campusExperiences.filter(isMeaningfulResumeEntry).flatMap((item) => [
            `${item.department}｜${item.period}`,
            item.description,
          ]),
        });
      } else {
        const text = isStandardModuleKey(key)
          ? key === "skills"
            ? resume.skills
            : key === "certificate"
              ? resume.certificate
              : key === "evaluation"
                ? resume.evaluation
                : key === "portfolio"
                  ? resume.portfolio
                  : ""
          : resume.customModules.find((item) => item.id === key)?.content || "";
        if (text.trim()) {
          sections.push({ heading: moduleLabel(resume, key), lines: [text] });
        }
      }
    });
  return sections;
}

function joinBytes(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
}

function utf16Hex(value: string) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    result += value.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return result;
}

function wrapExportText(value: string, maxWidth = 84) {
  const output: string[] = [];
  value
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((paragraph) => {
      let line = "";
      let width = 0;
      Array.from(paragraph).forEach((character) => {
        const nextWidth = /[\u0000-\u00ff]/.test(character) ? 1 : 2;
        if (line && width + nextWidth > maxWidth) {
          output.push(line);
          line = "";
          width = 0;
        }
        line += character;
        width += nextWidth;
      });
      if (line) output.push(line);
    });
  return output.length ? output : [""];
}

// 保留给后续重新启用的 ATS 文本 PDF 导出流程。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildAtsPdf(resume: Resume) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const lines: { text: string; size: number; gap: number }[] = [
    { text: resume.basic.name || "姓名", size: 18, gap: 24 },
    { text: resume.basic.target || resume.target, size: 11, gap: 17 },
    {
      text: [resume.basic.phone, resume.basic.email, resume.basic.city]
        .filter(Boolean)
        .join("｜"),
      size: 9,
      gap: 18,
    },
  ];
  if (resume.basic.summary.trim()) {
    lines.push({ text: "个人简介", size: 12, gap: 18 });
    wrapExportText(resume.basic.summary).forEach((text) =>
      lines.push({ text, size: 9, gap: 14 }),
    );
  }
  resumeExportSections(resume).forEach((section) => {
    lines.push({ text: section.heading, size: 12, gap: 19 });
    section.lines.filter(Boolean).forEach((entry) => {
      wrapExportText(entry).forEach((text) =>
        lines.push({ text, size: 9, gap: 14 }),
      );
    });
  });

  const pages: typeof lines[] = [];
  let page: typeof lines = [];
  let used = 0;
  lines.forEach((line) => {
    if (used + line.gap > 742 && page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(line);
    used += line.gap;
  });
  if (page.length) pages.push(page);

  const objects: (string | Uint8Array)[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const fontId = 3;
  const cidFontId = 4;
  const descriptorId = 5;
  const toUnicodeId = 6;
  objects[fontId] =
    `<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`;
  objects[cidFontId] =
    `<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor ${descriptorId} 0 R /DW 1000 /W [0 31 500 32 32 250 33 126 500] >>`;
  objects[descriptorId] =
    "<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [-250 -140 600 1000] /ItalicAngle 0 /Ascent 752 /Descent -271 /CapHeight 737 /StemV 58 >>";
  const unicodeMap = encode(
    "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n1 beginbfrange\n<0000> <FFFF> <0000>\nendbfrange\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend",
  );
  objects[toUnicodeId] = joinBytes([
    encode(`<< /Length ${unicodeMap.length} >>\nstream\n`),
    unicodeMap,
    encode("\nendstream"),
  ]);
  const pageIds: number[] = [];
  pages.forEach((pageLines) => {
    const pageId = objects.length;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    let y = 792;
    const stream = pageLines
      .map((line) => {
        const command = `BT /F1 ${line.size} Tf 1 0 0 1 50 ${y} Tm <${utf16Hex(line.text)}> Tj ET`;
        y -= line.gap;
        return command;
      })
      .join("\n");
    const streamBytes = encode(stream);
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = joinBytes([
      encode(`<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      encode("\nendstream"),
    ]);
  });
  objects[2] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    length += chunk.length;
  };
  const object = (id: number, body: string | Uint8Array) => {
    offsets[id] = length;
    push(encode(`${id} 0 obj\n`));
    push(typeof body === "string" ? encode(body) : body);
    push(encode("\nendobj\n"));
  };

  push(encode("%PDF-1.4\n"));
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  for (let id = 1; id < objects.length; id += 1) object(id, objects[id]);

  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  push(encode(xref));
  return joinBytes(chunks);
}

// 将预览快照逐页嵌入 A4，避免浏览器打印引擎重新计算排版。
type VisualPdfPage = {
  jpeg: Uint8Array;
  width: number;
  height: number;
  sha256: string;
};

type SharedPreviewRender = {
  canvases: HTMLCanvasElement[];
  pages: VisualPdfPage[];
  urls: string[];
};

function buildVisualPdf(pages: VisualPdfPage[]) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    length += chunk.length;
  };
  const object = (id: number, body: string | Uint8Array) => {
    offsets[id] = length;
    push(encode(`${id} 0 obj\n`));
    push(typeof body === "string" ? encode(body) : body);
    push(encode("\nendobj\n"));
  };
  push(encode("%PDF-1.4\n"));
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectIds = pages.map((_, index) => 3 + index * 3);
  object(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  pages.forEach((page, index) => {
    const pageId = pageObjectIds[index];
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    offsets[imageId] = length;
    push(encode(`${imageId} 0 obj\n`));
    push(
      encode(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      ),
    );
    push(page.jpeg);
    push(encode("\nendstream\nendobj\n"));
    const content = encode("q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n");
    object(
      contentId,
      joinBytes([
        encode(`<< /Length ${content.length} >>\nstream\n`),
        content,
        encode("endstream"),
      ]),
    );
  });
  const xrefOffset = length;
  const objectCount = 3 + pages.length * 3;
  let xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n`;
  for (let id = 1; id < objectCount; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  push(encode(xref));
  return joinBytes(chunks);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files: { name: string; data: Uint8Array }[]) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  const viewBytes = (length: number, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(length);
    write(new DataView(bytes.buffer));
    return bytes;
  };
  files.forEach(({ name, data }) => {
    const nameBytes = encode(name);
    const checksum = crc32(data);
    const local = viewBytes(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint32(14, checksum, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, nameBytes.length, true);
    });
    locals.push(local, nameBytes, data);
    const central = viewBytes(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint32(16, checksum, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, nameBytes.length, true);
      view.setUint32(42, offset, true);
    });
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  });
  const centralData = joinBytes(centrals);
  const end = viewBytes(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralData.length, true);
    view.setUint32(16, offset, true);
  });
  return joinBytes([...locals, centralData, end]);
}

// 保留给后续重新启用的结构化 DOCX 导出流程。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildDocx(resume: Resume) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const paragraph = (
    text: string,
    {
      bold = false,
      size = 20,
      color = "25302A",
      before = 0,
      after = 70,
      border = false,
      keepNext = false,
    }: {
      bold?: boolean;
      size?: number;
      color?: string;
      before?: number;
      after?: number;
      border?: boolean;
      keepNext?: boolean;
    } = {},
  ) =>
    `<w:p><w:pPr><w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>${keepNext ? "<w:keepNext/>" : ""}${border ? '<w:pBdr><w:bottom w:val="single" w:sz="7" w:space="5" w:color="315F4C"/></w:pBdr>' : ""}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
  const sectionHeading = (text: string) =>
    paragraph(text, {
      bold: true,
      size: 23,
      color: "173D2D",
      before: 150,
      after: 100,
      border: true,
      keepNext: true,
    });
  const entryTitle = (text: string) =>
    paragraph(text, { bold: true, size: 20, before: 40, after: 45, keepNext: true });
  const bodyBlocks: string[] = [];
  if (isPreviewModuleVisible(resume, "experience")) {
    bodyBlocks.push(sectionHeading("实习经历"));
    resume.experiences.filter(isMeaningfulResumeEntry).forEach((item) => {
      bodyBlocks.push(entryTitle(`${item.company} ｜ ${item.role} ｜ ${item.period}`));
      if (item.description) bodyBlocks.push(paragraph(item.description));
    });
  }
  if (isPreviewModuleVisible(resume, "education")) {
    bodyBlocks.push(sectionHeading("教育经历"));
    resume.educations.filter(isMeaningfulResumeEntry).forEach((item) => {
      bodyBlocks.push(
        entryTitle(`${item.school} ｜ ${item.major} ｜ ${item.degree} ｜ ${item.period}`),
      );
      if (item.detail) bodyBlocks.push(paragraph(item.detail));
    });
  }
  if (isPreviewModuleVisible(resume, "project")) {
    bodyBlocks.push(sectionHeading("项目经历"));
    resume.projects.filter(isMeaningfulResumeEntry).forEach((item) => {
      bodyBlocks.push(entryTitle(`${item.name} ｜ ${item.role} ｜ ${item.period}`));
      if (item.stack) bodyBlocks.push(paragraph(`技术栈：${item.stack}`, { bold: true }));
      if (item.description) bodyBlocks.push(paragraph(item.description));
    });
  }
  if (isPreviewModuleVisible(resume, "campus")) {
    bodyBlocks.push(sectionHeading("校园经历"));
    resume.campusExperiences.filter(isMeaningfulResumeEntry).forEach((item) => {
      bodyBlocks.push(entryTitle(`${item.department} ｜ ${item.period}`));
      if (item.description) bodyBlocks.push(paragraph(item.description));
    });
  }
  const simpleSections: [ModuleKey, string, string][] = [
    ["skills", "技能特长", resume.skills],
    ["certificate", "证书荣誉", resume.certificate],
    ["evaluation", "自我评价", resume.evaluation],
    ["portfolio", "作品链接", resume.portfolio],
  ];
  simpleSections.forEach(([key, heading, text]) => {
    if (isPreviewModuleVisible(resume, key) && text.trim()) {
      bodyBlocks.push(sectionHeading(heading), paragraph(text));
    }
  });
  const body = [
    paragraph(resume.basic.name || "姓名", {
      bold: true,
      size: 38,
      color: "173D2D",
      after: 75,
    }),
    paragraph(resume.basic.target || resume.target, {
      bold: true,
      size: 22,
      color: "315F4C",
      after: 60,
    }),
    paragraph(
      [resume.basic.phone, resume.basic.email, resume.basic.city]
        .filter(Boolean)
        .join(" ｜ "),
      { size: 18, color: "5F6D65", after: 100 },
    ),
    ...(resume.basic.summary.trim()
      ? [sectionHeading("个人简介"), paragraph(resume.basic.summary)]
      : []),
    ...bodyBlocks,
  ].join("");
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="760" w:right="900" w:bottom="760" w:left="900" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Microsoft YaHei"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="zh-CN" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="70" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
  return zipStored([
    {
      name: "[Content_Types].xml",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    { name: "word/document.xml", data: encode(documentXml) },
    { name: "word/styles.xml", data: encode(stylesXml) },
    {
      name: "word/_rels/document.xml.rels",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      ),
    },
  ]);
}

// 保留给后续重新启用的预览型 DOCX 导出流程。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildPreviewDocx(png: Uint8Array) {
  const encode = (value: string) => new TextEncoder().encode(value);
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="7559055" cy="10692000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="简历预览"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="resume.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7559055" cy="10692000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zipStored([
    {
      name: "[Content_Types].xml",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
      ),
    },
    {
      name: "_rels/.rels",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
      ),
    },
    {
      name: "word/_rels/document.xml.rels",
      data: encode(
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/resume.png"/></Relationships>`,
      ),
    },
    { name: "word/document.xml", data: encode(documentXml) },
    { name: "word/media/resume.png", data: png },
  ]);
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [resumes, setResumes] = useState<Resume[]>([blankResume]);
  const [currentId, setCurrentId] = useState(blankResume.id);
  const [activeModule, setActiveModule] = useState<ModuleKey>("basic");
  const [template, setTemplate] = useState<Template>("classic");
  const [saveStatus, setSaveStatus] = useState("已保存");
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("我的校招简历");
  const [showVersion, setShowVersion] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [histories, setHistories] = useState<ResumeHistory>({});
  const [showImport, setShowImport] = useState(false);
  const [parsedImport, setParsedImport] = useState<ParsedResumeText | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [jdText, setJdText] = useState(jdSample);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisTab, setAnalysisTab] = useState("match");
  const [jdAnalysis, setJdAnalysis] = useState<JDAnalysisResult | null>(null);
  const [suggestions, setSuggestions] =
    useState<Suggestion[]>(initialSuggestions);
  const [selectedSuggestion, setSelectedSuggestion] = useState(1);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [localPreviewMode, setLocalPreviewMode] = useState(false);
  const [persistence, setPersistence] = useState<{
    identity: IdentityEpoch;
    cloudSaveAllowed: boolean;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const identityRef = useRef<IdentityEpoch>({ generation: 0, userId: null });
  const jdAnalysisTimerRef = useRef<number | null>(null);

  const current =
    resumes.find((resume) => resume.id === currentId) ?? resumes[0];

  const applyWorkspace = (parsed: unknown) => {
      if (!isRecord(parsed)) return;
      const normalizedResumes = Array.isArray(parsed.resumes)
        ? parsed.resumes.map(normalizeResume)
        : [];
      if (normalizedResumes.length) {
        setResumes(normalizedResumes);
        const requestedId = safeString(parsed.currentId);
        setCurrentId(
          normalizedResumes.some((resume) => resume.id === requestedId)
            ? requestedId
            : normalizedResumes[0].id,
        );
      }
      if (
        parsed.template === "classic" ||
        parsed.template === "azure" ||
        parsed.template === "sidebar"
      ) {
        setTemplate(parsed.template);
      }
      if (isRecord(parsed.histories)) {
        const migrated = Object.fromEntries(
          Object.entries(parsed.histories).map(([resumeId, snapshots]) => [
            resumeId,
            Array.isArray(snapshots)
              ? snapshots
                  .filter(isRecord)
                  .map((snapshot, index) => ({
                    id:
                      safeString(snapshot.id) ||
                      `history-${Date.now()}-${index}`,
                    label: safeString(snapshot.label, `历史版本 ${index + 1}`),
                    createdAt: safeString(snapshot.createdAt),
                    resume: normalizeResume(snapshot.resume),
                  }))
              : [],
          ]),
        );
        setHistories(migrated);
      }
  };

  const resetSensitiveState = () => {
    const clean = createCleanWorkspace();
    setView("dashboard");
    setResumes(clean.resumes);
    setCurrentId(clean.currentId);
    setActiveModule("basic");
    setTemplate(clean.template);
    setSaveStatus("尚未保存");
    setToast("");
    setShowNew(false);
    setNewName("我的校招简历");
    setShowVersion(false);
    setShowHistory(false);
    setVersionName("");
    setHistories(clean.histories);
    setShowImport(false);
    setParsedImport(null);
    setImportFileName("");
    setImportStatus("");
    setImportProgress(0);
    setJdText("");
    setAnalysisReady(false);
    setAnalyzing(false);
    setAnalysisTab("match");
    setJdAnalysis(null);
    setSuggestions([]);
    setSelectedSuggestion(1);
    if (jdAnalysisTimerRef.current !== null) {
      window.clearTimeout(jdAnalysisTimerRef.current);
      jdAnalysisTimerRef.current = null;
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  useEffect(() => {
    let cancelled = false;
    const loadController = new AbortController();
    const initialize = async () => {
      resetSensitiveState();
      setPersistence(null);
      try {
        const localPreview = ["localhost", "127.0.0.1", "::1"].includes(
          window.location.hostname,
        );
        if (localPreview) {
          const identity = advanceIdentityEpoch(identityRef.current, null);
          identityRef.current = identity;
          setLocalPreviewMode(true);
          const anonymous = readLocalWorkspace(ANONYMOUS_WORKSPACE_KEY);
          const legacy = LEGACY_SHARED_WORKSPACE_KEYS
            .map(readLocalWorkspace)
            .find((workspace) => workspace !== null);
          if (anonymous ?? legacy) applyWorkspace(anonymous ?? legacy);
          setPersistence({ identity, cloudSaveAllowed: false });
          return;
        }
        const redirected = await consumeAuthRedirect();
        const activeSession = redirected ?? (await getSession());
        if (cancelled) return;
        const identity = advanceIdentityEpoch(
          identityRef.current,
          activeSession?.user.id ?? null,
        );
        identityRef.current = identity;
        setSession(activeSession);

        if (activeSession) {
          let cloudResult;
          try {
            cloudResult = await loadWorkspace<StoredWorkspace>(
              activeSession,
              loadController.signal,
            );
          } catch (error) {
            if (loadController.signal.aborted) return;
            cloudResult = { status: "unavailable" } as const;
            setAuthMessage(
              error instanceof Error
                ? `云端读取失败：${error.message}。已暂停云端自动保存。`
                : "云端读取失败，已暂停云端自动保存。",
            );
          }
          if (
            cancelled ||
            !isCurrentIdentity(identity, identityRef.current)
          ) return;
          const accountCache = readLocalWorkspace(
            accountWorkspaceKey(activeSession.user.id),
          ) as StoredWorkspace | null;
          const resolved = resolveAuthenticatedWorkspace(
            cloudResult,
            accountCache,
            createCleanWorkspace,
          );
          applyWorkspace(resolved.workspace);
          setPersistence({
            identity,
            cloudSaveAllowed: resolved.cloudSaveAllowed,
          });
        } else if (!cloudConfigured) {
          const anonymous = readLocalWorkspace(ANONYMOUS_WORKSPACE_KEY);
          const legacy = LEGACY_SHARED_WORKSPACE_KEYS
            .map(readLocalWorkspace)
            .find((workspace) => workspace !== null);
          if (anonymous ?? legacy) applyWorkspace(anonymous ?? legacy);
          setPersistence({ identity, cloudSaveAllowed: false });
        }
      } catch (error) {
        setAuthMessage(error instanceof Error ? error.message : "登录状态读取失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void initialize();
    return () => {
      cancelled = true;
      loadController.abort();
    };
  }, []);

  useEffect(() => {
    if (!ready || !persistence) return;
    const expectedIdentity = persistence.identity;
    const saveController = new AbortController();
    const timer = window.setTimeout(() => {
      if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
      const workspace: StoredWorkspace = {
        resumes,
        currentId,
        template,
        histories,
      };
      if (session) {
        if (expectedIdentity.userId !== session.user.id) return;
        localStorage.setItem(
          accountWorkspaceKey(session.user.id),
          JSON.stringify(workspace),
        );
        if (!persistence.cloudSaveAllowed) {
          setSaveStatus("仅保存在本账号设备缓存，云端自动保存已暂停");
          return;
        }
        void saveWorkspace(session, workspace, saveController.signal)
          .then(() => {
            if (isCurrentIdentity(expectedIdentity, identityRef.current)) {
              setSaveStatus(`云端已保存 ${storageTime()}`);
            }
          })
          .catch((error) => {
            if (
              error instanceof DOMException &&
              error.name === "AbortError"
            ) return;
            if (isCurrentIdentity(expectedIdentity, identityRef.current)) {
              setSaveStatus("云端保存失败，已保存在本账号设备缓存");
            }
          });
      } else {
        if (expectedIdentity.userId !== null) return;
        localStorage.setItem(
          ANONYMOUS_WORKSPACE_KEY,
          JSON.stringify(workspace),
        );
        setSaveStatus(`本机已保存 ${storageTime()}`);
      }
    }, 550);
    return () => {
      window.clearTimeout(timer);
      saveController.abort();
    };
  }, [resumes, currentId, template, histories, ready, session, persistence]);

  useEffect(() => {
    if (!session) return;
    const expectedIdentity = identityRef.current;
    let cancelled = false;

    const invalidateSession = () => {
      if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
      identityRef.current = advanceIdentityEpoch(identityRef.current, null);
      setPersistence(null);
      setSession(null);
      resetSensitiveState();
      setAuthMessage("登录状态已失效，请重新登录");
      setReady(true);
    };

    const refreshOrInvalidate = async () => {
      const refreshed = await getSession();
      if (
        cancelled ||
        !isCurrentIdentity(expectedIdentity, identityRef.current)
      ) return;
      if (!refreshed || refreshed.user.id !== expectedIdentity.userId) {
        invalidateSession();
        return;
      }
      setSession(refreshed);
    };

    const refreshDelay = Math.max(
      0,
      session.expiresAt * 1000 - Date.now() - 60_000,
    );
    const refreshTimer = window.setTimeout(() => {
      void refreshOrInvalidate();
    }, refreshDelay);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY) void refreshOrInvalidate();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      window.removeEventListener("storage", handleStorage);
    };
    // resetSensitiveState intentionally invalidates every sensitive UI state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.expiresAt, session?.user.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const updateCurrent = (patch: Partial<Resume>) => {
    setResumes((items) =>
      items.map((item) =>
        item.id === currentId
          ? { ...item, ...patch, updated: "刚刚" }
          : item,
      ),
    );
  };

  const updateNested = (
    key: "basic",
    field: string,
    value: string,
  ) => {
    updateCurrent({
      [key]: { ...current[key], [field]: value },
    } as Partial<Resume>);
  };

  const updateEntry = (
    collection: EntryCollection,
    id: string,
    patch: Record<string, string>,
  ) => {
    updateCurrent({
      [collection]: current[collection].map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    } as Partial<Resume>);
  };

  const addEntry = (collection: EntryCollection) => {
    const id = `${collection}-${Date.now()}`;
    const blank =
      collection === "experiences"
        ? { id, company: "", role: "", period: "", description: "" }
        : collection === "educations"
          ? { id, school: "", major: "", degree: "", period: "", detail: "" }
          : collection === "projects"
            ? { id, name: "", role: "", period: "", stack: "", description: "" }
            : { id, department: "", period: "", description: "" };
    updateCurrent({
      [collection]: [...current[collection], blank],
    } as Partial<Resume>);
  };

  const duplicateEntry = (
    collection: EntryCollection,
    id: string,
  ) => {
    const source = current[collection].find((item) => item.id === id);
    if (!source) return;
    const index = current[collection].findIndex((item) => item.id === id);
    const next = [...current[collection]];
    next.splice(index + 1, 0, {
      ...source,
      id: `${collection}-${Date.now()}`,
    });
    updateCurrent({ [collection]: next } as Partial<Resume>);
    setToast("已复制一条经历");
  };

  const deleteEntry = (
    collection: EntryCollection,
    id: string,
  ) => {
    if (current[collection].length === 1) {
      setToast("请至少保留一条记录，可清空内容");
      return;
    }
    updateCurrent({
      [collection]: current[collection].filter((item) => item.id !== id),
    } as Partial<Resume>);
  };

  const moveEntry = (
    collection: EntryCollection,
    id: string,
    direction: -1 | 1,
  ) => {
    const next = [...current[collection]];
    const index = next.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateCurrent({ [collection]: next } as Partial<Resume>);
  };

  const openResume = (id: string) => {
    setCurrentId(id);
    setView("editor");
    setActiveModule("basic");
  };

  const createResume = () => {
    const id = `resume-${Date.now()}`;
    const created: Resume = {
      ...seedResume,
      id,
      name: newName.trim() || "未命名简历",
      target: "待填写求职目标",
      updated: "刚刚",
      completion: 35,
      version: 1,
      basic: {
        name: "",
        phone: "",
        email: "",
        city: "",
        target: "",
        summary: "",
      },
      experiences: [{
        id: `experience-${Date.now()}`,
        company: "",
        role: "",
        period: "",
        description: "",
      }],
      educations: [{
        id: `education-${Date.now()}`,
        school: "",
        major: "",
        degree: "",
        period: "",
        detail: "",
      }],
      projects: [{
        id: `project-${Date.now()}`,
        name: "",
        role: "",
        period: "",
        stack: "",
        description: "",
      }],
      campusExperiences: [{
        id: `campus-${Date.now()}`,
        department: "",
        period: "",
        description: "",
      }],
      skills: "",
      certificate: "",
      evaluation: "",
      portfolio: "",
      moduleLabels: {},
      customModules: [],
      moduleOrder: [...defaultOrder],
      hiddenModules: [],
    };
    setResumes((items) => [created, ...items]);
    setCurrentId(id);
    setShowNew(false);
    setView("editor");
    setToast("新简历已创建");
  };

  const duplicateResume = (resume: Resume) => {
    const copy = {
      ...resume,
      id: `resume-${Date.now()}`,
      name: `${resume.name} · 副本`,
      updated: "刚刚",
      basic: { ...resume.basic },
      experiences: resume.experiences.map((item) => ({
        ...item,
        id: `experience-${Date.now()}-${item.id}`,
      })),
      educations: resume.educations.map((item) => ({
        ...item,
        id: `education-${Date.now()}-${item.id}`,
      })),
      projects: resume.projects.map((item) => ({
        ...item,
        id: `project-${Date.now()}-${item.id}`,
      })),
      campusExperiences: resume.campusExperiences.map((item) => ({
        ...item,
        id: `campus-${Date.now()}-${item.id}`,
      })),
      moduleLabels: { ...resume.moduleLabels },
      customModules: resume.customModules.map((item) => ({ ...item })),
    };
    setResumes((items) => [copy, ...items]);
    setToast("已复制为新的简历");
  };

  const deleteResume = (resume: Resume) => {
    if (
      !window.confirm(
        `永久删除简历「${resume.name}」？\n\n仅删除这份简历及其历史版本，无法撤销。`,
      )
    ) {
      return;
    }

    const result = removeResumeFromWorkspace(
      resumes,
      currentId,
      histories,
      resume.id,
      () => ({
        ...cloneResume(blankResume),
        id: `resume-${Date.now()}`,
        updated: "刚刚",
      }),
    );
    if (!result.deleted) return;

    setResumes(result.resumes);
    setCurrentId(result.currentId);
    setHistories(result.histories);
    setToast(
      result.createdReplacement
        ? `已删除「${resume.name}」，并创建一份干净空白简历`
        : `已删除简历「${resume.name}」及其历史版本`,
    );
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const expectedIdentity = identityRef.current;
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportFileName(file.name);
    setImportStatus("正在本地解析文件…");
    setImportProgress(0);
    setParsedImport(null);
    setShowImport(true);
    try {
      const text = await extractResumeText(file, (value) => {
        if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
        setImportProgress(Math.round(value * 100));
        setImportStatus(`正在本地识别图片文字… ${Math.round(value * 100)}%`);
      });
      if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
      if (!text.trim()) throw new Error("文件中未提取到可用文字");
      const parsed = parseResumeText(text);
      setParsedImport(parsed);
      setImportStatus("解析完成，请导入后逐项校对");
    } catch (error) {
      if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
      setImportStatus(
        error instanceof Error ? error.message : "文件解析失败，请换一种格式重试",
      );
    }
  };

  const confirmImport = () => {
    if (!parsedImport) return;
    const imported: Resume = normalizeResume({
      ...blankResume,
      id: `resume-${Date.now()}`,
      name: importFileName.replace(/\.(pdf|docx|txt|png|jpe?g)$/i, "") || "导入的简历",
      updated: "刚刚",
      basic: {
        ...blankResume.basic,
        name: parsedImport.name,
        phone: parsedImport.phone,
        email: parsedImport.email,
        city: parsedImport.city,
        summary: parsedImport.summary,
      },
      experiences: parsedImport.experience
        ? splitResumeEntries(parsedImport.experience).map((entry, index) => {
            const [heading = "", ...descriptionLines] = entry.split("\n");
            const [company = "", role = "", period = ""] = heading.split("｜");
            return {
              id: `experience-${Date.now()}-${index}`,
              company,
              role,
              period,
              description: descriptionLines.join("\n"),
            };
          })
        : [],
      educations: parsedImport.education
        ? splitResumeEntries(parsedImport.education).map((entry, index) => {
            const [heading = "", ...detailLines] = entry.split("\n");
            const [school = "", major = "", degree = "", period = ""] = heading.split("｜");
            return {
              id: `education-${Date.now()}-${index}`,
              school,
              major,
              degree,
              period,
              detail: detailLines.join("\n"),
            };
          })
        : [],
      projects: parsedImport.project
        ? splitResumeEntries(parsedImport.project).map((entry, index) => {
            const [heading = "", ...bodyLines] = entry.split("\n");
            const [name = "", role = "", period = ""] = heading.split("｜");
            const stackLine = bodyLines[0]?.startsWith("技术栈：") ? bodyLines.shift() ?? "" : "";
            return {
              id: `project-${Date.now()}-${index}`,
              name,
              role,
              period,
              stack: stackLine.replace(/^技术栈：/, ""),
              description: bodyLines.join("\n"),
            };
          })
        : [],
      campusExperiences: parsedImport.campus
        ? splitResumeEntries(parsedImport.campus).map((entry, index) => {
            const [heading = "", ...descriptionLines] = entry.split("\n");
            const [department = "", role = "", period = ""] = heading.split("｜");
            return {
              id: `campus-${Date.now()}-${index}`,
              department: [department, role].filter(Boolean).join("｜"),
              period,
              description: descriptionLines.join("\n"),
            };
          })
        : [],
      skills: parsedImport.skills,
      certificate: parsedImport.certificate,
      evaluation: parsedImport.evaluation,
      portfolio: parsedImport.portfolio,
      completion: 45,
    });
    setResumes((items) => [imported, ...items]);
    setShowImport(false);
    setParsedImport(null);
    setCurrentId(imported.id);
    setToast("解析内容已导入，请逐项校对");
    setView("editor");
  };

  const updateParsedImport = (
    field: keyof ParsedResumeText,
    value: string,
  ) => {
    setParsedImport((currentImport) =>
      currentImport ? { ...currentImport, [field]: value } : currentImport,
    );
  };

  const moveModule = (key: ModuleKey, direction: -1 | 1) => {
    const order = [...current.moduleOrder];
    const index = order.indexOf(key);
    const next = index + direction;
    if (next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    updateCurrent({ moduleOrder: order });
  };

  const hideModule = (key: ModuleKey) => {
    if (key === "basic") return;
    updateCurrent({
      hiddenModules: [...new Set([...current.hiddenModules, key])],
    });
    const next = current.moduleOrder.find(
      (item) => item !== key && !current.hiddenModules.includes(item),
    );
    if (next) setActiveModule(next);
    setToast(`${moduleLabel(current, key)}已从预览中隐藏`);
  };

  const restoreModule = (key: ModuleKey) => {
    updateCurrent({
      hiddenModules: current.hiddenModules.filter((item) => item !== key),
    });
    setActiveModule(key);
    setToast(`${moduleLabel(current, key)}已恢复`);
  };

  const renameModule = (key: ModuleKey, title: string) => {
    if (key === "basic") return;
    if (isStandardModuleKey(key)) {
      updateCurrent({
        moduleLabels: {
          ...current.moduleLabels,
          [key]: title.slice(0, 24),
        },
      });
      return;
    }
    updateCurrent({
      customModules: current.customModules.map((item) =>
        item.id === key ? { ...item, title: title.slice(0, 24) } : item,
      ),
    });
  };

  const addCustomModule = (title: string) => {
    const id = `custom:${Date.now()}` as CustomModuleKey;
    const nextTitle = title.trim().slice(0, 24) || "自定义模块";
    updateCurrent({
      customModules: [
        ...current.customModules,
        { id, title: nextTitle, content: "" },
      ],
      moduleOrder: [...current.moduleOrder, id],
    });
    setActiveModule(id);
    setToast(`已添加「${nextTitle}」`);
  };

  const updateCustomModule = (key: CustomModuleKey, content: string) => {
    updateCurrent({
      customModules: current.customModules.map((item) =>
        item.id === key ? { ...item, content } : item,
      ),
    });
  };

  const deleteCustomModule = (key: CustomModuleKey) => {
    const label = moduleLabel(current, key);
    updateCurrent({
      customModules: current.customModules.filter((item) => item.id !== key),
      moduleOrder: current.moduleOrder.filter((item) => item !== key),
      hiddenModules: current.hiddenModules.filter((item) => item !== key),
    });
    setActiveModule("basic");
    setToast(`已删除「${label}」`);
  };

  const analyzeJD = () => {
    if (jdText.trim().length < 80) {
      setToast("请补充完整的岗位职责和任职要求");
      return;
    }
    setAnalyzing(true);
    setAnalysisReady(false);
    const expectedIdentity = identityRef.current;
    jdAnalysisTimerRef.current = window.setTimeout(() => {
      jdAnalysisTimerRef.current = null;
      if (!isCurrentIdentity(expectedIdentity, identityRef.current)) return;
      const result = analyzeWithRules(jdText, current);
      setJdAnalysis(result);
      const nextSuggestions = buildRuleSuggestions(current, result);
      setSuggestions(nextSuggestions);
      setSelectedSuggestion(nextSuggestions[0]?.id ?? 1);
      setAnalyzing(false);
      setAnalysisReady(true);
      setAnalysisTab("match");
      if (!result.keywords.length) {
        setToast("未识别到常见岗位关键词，请补充更完整的任职要求");
      }
    }, 350);
  };

  const updateSuggestion = (
    id: number,
    status: Suggestion["status"],
  ) => {
    const target = suggestions.find((item) => item.id === id);
    if (target && !target.safe && status === "accepted") {
      setToast("请先补充真实信息，此建议暂不可接受");
      return;
    }
    setSuggestions((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    setToast(status === "accepted" ? "已接受这处修改" : "已保留原文");
  };

  const saveOptimizedVersion = () => {
    const acceptedSuggestions = suggestions.filter(
      (item) => item.status === "accepted",
    );
    if (!acceptedSuggestions.length) {
      setToast("请至少接受一处安全修改");
      return;
    }
    const optimizedResume = cloneResume(current);
    for (const suggestion of acceptedSuggestions) {
      if (suggestion.applyTo === "skills") {
        optimizedResume.skills = suggestion.optimized;
      } else if (suggestion.applyTo === "summary") {
        optimizedResume.basic.summary = suggestion.optimized;
      } else if (suggestion.applyTo === "experience" && suggestion.targetId) {
        optimizedResume.experiences = optimizedResume.experiences.map((item) =>
          item.id === suggestion.targetId
            ? { ...item, description: suggestion.optimized }
            : item,
        );
      } else if (suggestion.applyTo === "project" && suggestion.targetId) {
        optimizedResume.projects = optimizedResume.projects.map((item) =>
          item.id === suggestion.targetId
            ? { ...item, description: suggestion.optimized }
            : item,
        );
      }
    }
    saveSnapshot(
      versionName.trim() || `${current.name} · JD 定向版`,
      {
        ...optimizedResume,
        name: `${current.name.replace(/ · JD 定向版$/, "")} · JD 定向版`,
      },
    );
    setShowVersion(false);
    setToast(`已保存新版本，包含 ${acceptedSuggestions.length} 处修改`);
    setView("dashboard");
  };

  const saveSnapshot = (label: string, source: Resume = current) => {
    const nextResume = cloneResume({
      ...source,
      id: current.id,
      version: current.version + 1,
      updated: "刚刚",
    });
    const snapshot: ResumeSnapshot = {
      id: `snapshot-${Date.now()}`,
      label: label.trim() || `${current.name} · 版本 ${nextResume.version}`,
      createdAt: snapshotTime(),
      resume: cloneResume(nextResume),
    };
    setHistories((items) => ({
      ...items,
      [current.id]: [snapshot, ...(items[current.id] ?? [])],
    }));
    setResumes((items) =>
      items.map((item) => (item.id === current.id ? nextResume : item)),
    );
    setShowVersion(false);
    setVersionName("");
  };

  const restoreSnapshot = (snapshot: ResumeSnapshot) => {
    if (!window.confirm(`恢复到「${snapshot.label}」？当前内容会先自动备份。`)) return;
    const backup: ResumeSnapshot = {
      id: createUniqueId("snapshot-backup"),
      label: `恢复前自动备份 · V${current.version}`,
      createdAt: snapshotTime(),
      resume: cloneResume(current),
    };
    const restored = cloneResume({
      ...snapshot.resume,
      id: current.id,
      updated: "刚刚",
    });
    setHistories((items) => ({
      ...items,
      [current.id]: [backup, ...(items[current.id] ?? [])],
    }));
    setResumes((items) =>
      items.map((item) => (item.id === current.id ? restored : item)),
    );
    setShowHistory(false);
    setToast(`已恢复 ${snapshot.label}`);
  };

  const submitPasswordAuth = async () => {
    const email = authEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthMessage("请输入有效的邮箱地址");
      return;
    }
    if (authPassword.length < 8) {
      setAuthMessage("密码至少需要 8 位");
      return;
    }
    if (authMode === "register" && authPassword !== authPasswordConfirm) {
      setAuthMessage("两次输入的密码不一致");
      return;
    }
    setAuthLoading(true);
    setAuthMessage("");
    try {
      const activeSession =
        authMode === "register"
          ? await signUpWithPassword(email, authPassword)
          : await signInWithPassword(email, authPassword);
      setSession(activeSession);
      window.location.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      const friendlyMessage =
        message === "Invalid login credentials"
          ? "邮箱或密码错误"
          : message.toLowerCase().includes("already registered")
            ? "该邮箱已注册，请切换到登录"
            : message.toLowerCase().includes("password")
              ? "密码不符合安全要求，请至少使用 8 位字符"
              : message;
      setAuthMessage(friendlyMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const previousSession = session;
    identityRef.current = advanceIdentityEpoch(identityRef.current, null);
    setPersistence(null);
    setSession(null);
    resetSensitiveState();
    setReady(true);
    await signOut(previousSession);
  };

  const deleteSnapshot = (snapshot: ResumeSnapshot) => {
    if (!window.confirm(`永久删除当前简历的历史版本「${snapshot.label}」？此操作无法撤销。`)) return;
    setHistories((items) =>
      removeCurrentResumeSnapshot(items, current.id, snapshot.id),
    );
    setToast(`已删除历史版本 ${snapshot.label}`);
  };

  const navItems: { key: View; label: string; icon: string }[] = [
    { key: "dashboard", label: "简历中心", icon: "简" },
    { key: "editor", label: "简历编辑", icon: "编" },
    { key: "jd", label: "JD 匹配", icon: "析" },
    { key: "optimize", label: "优化对比", icon: "优" },
  ];

  if (!ready) {
    return (
      <main className="auth-page">
        <div className="auth-loading"><span className="big-spinner" />正在读取你的简历…</div>
      </main>
    );
  }

  if (cloudConfigured && !session && !localPreviewMode) {
    return (
      <AuthPage
        mode={authMode}
        setMode={(mode) => {
          setAuthMode(mode);
          setAuthMessage("");
          setAuthPassword("");
          setAuthPasswordConfirm("");
        }}
        email={authEmail}
        setEmail={setAuthEmail}
        password={authPassword}
        setPassword={setAuthPassword}
        passwordConfirm={authPasswordConfirm}
        setPasswordConfirm={setAuthPasswordConfirm}
        loading={authLoading}
        message={authMessage}
        submit={submitPasswordAuth}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <button
          className="brand"
          onClick={() => setView("dashboard")}
          aria-label="返回简历中心"
        >
          <span className="brand-mark">知</span>
          <span className="brand-copy">
            <strong>知途</strong>
            <small>校招简历助手</small>
          </span>
        </button>

        <nav className="main-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={view === item.key ? "nav-item active" : "nav-item"}
              onClick={() => {
                if (item.key === "optimize" && !analysisReady) {
                  setView("jd");
                  setToast("请先完成一次 JD 分析");
                } else {
                  setView(item.key);
                }
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="truth-card">
            <span>事实安全</span>
            <strong>只基于已有内容</strong>
            <p>规则建议由你确认后生效</p>
          </div>
          <button
            className="profile-chip"
            onClick={session ? handleSignOut : undefined}
            title={session ? "点击退出登录" : "本机模式"}
          >
            <span>{session?.user.email.slice(0, 1).toUpperCase() ?? "本"}</span>
            <span>
              <strong>{session?.user.email ?? "本机模式"}</strong>
              <small>{session ? "云端同步 · 点击退出" : "数据仅存本机"}</small>
            </span>
          </button>
        </div>
      </aside>

      <section className="app-main">
        {view === "dashboard" && (
          <Dashboard
            resumes={resumes}
            histories={histories}
            openResume={openResume}
            duplicateResume={duplicateResume}
            deleteResume={deleteResume}
            openHistory={(id) => {
              setCurrentId(id);
              setShowHistory(true);
            }}
            setShowNew={setShowNew}
            triggerImport={() => fileRef.current?.click()}
            goJD={() => setView("jd")}
          />
        )}

        {view === "editor" && current && (
          <Editor
            resume={current}
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            template={template}
            setTemplate={setTemplate}
            saveStatus={saveStatus}
            updateCurrent={updateCurrent}
            updateNested={updateNested}
            moveModule={moveModule}
            hideModule={hideModule}
            restoreModule={restoreModule}
            renameModule={renameModule}
            addCustomModule={addCustomModule}
            updateCustomModule={updateCustomModule}
            deleteCustomModule={deleteCustomModule}
            updateEntry={updateEntry}
            addEntry={addEntry}
            duplicateEntry={duplicateEntry}
            deleteEntry={deleteEntry}
            moveEntry={moveEntry}
            goDashboard={() => setView("dashboard")}
            goJD={() => setView("jd")}
            setShowVersion={(value) => {
              setVersionName(
                view === "optimize"
                  ? "Java 后端开发 · JD 定向版"
                  : `${current.name} · 版本 ${current.version + 1}`,
              );
              setShowVersion(value);
            }}
            historyCount={(histories[current.id] ?? []).length}
            showHistory={() => setShowHistory(true)}
            notify={setToast}
          />
        )}

        {view === "jd" && (
          <JDPage
            resumes={resumes}
            currentId={currentId}
            setCurrentId={setCurrentId}
            jdText={jdText}
            setJdText={setJdText}
            analyzing={analyzing}
            analysisReady={analysisReady}
            analysis={jdAnalysis}
            suggestionCount={suggestions.length}
            suggestions={suggestions}
            analyzeJD={analyzeJD}
            analysisTab={analysisTab}
            setAnalysisTab={setAnalysisTab}
            goOptimize={() => setView("optimize")}
          />
        )}

        {view === "optimize" && (
          <OptimizePage
            suggestions={suggestions}
            target={current.basic.target || current.target || "目标岗位"}
            selected={selectedSuggestion}
            setSelected={setSelectedSuggestion}
            updateSuggestion={updateSuggestion}
            save={() => {
              setVersionName(`${current.name} · JD 定向版`);
              setShowVersion(true);
            }}
            back={() => setView("jd")}
          />
        )}
      </section>

      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept=".pdf,.docx,.txt,image/png,image/jpeg"
        onChange={handleImport}
      />
      {showNew && (
        <Modal title="创建一份新简历" onClose={() => setShowNew(false)}>
          <label className="field">
            <span>简历名称</span>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoFocus
            />
          </label>
          <div className="choice-grid">
            <button className="choice-card selected">
              <span className="choice-icon">＋</span>
              <strong>空白简历</strong>
              <small>从模块化表单开始填写</small>
            </button>
            <button
              className="choice-card"
              onClick={() => fileRef.current?.click()}
            >
              <span className="choice-icon">导</span>
              <strong>导入旧简历</strong>
              <small>支持 PDF、Word 与图片</small>
            </button>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setShowNew(false)}>
              取消
            </button>
            <button className="btn primary" onClick={createResume}>
              创建并编辑
            </button>
          </div>
        </Modal>
      )}

      {showImport && (
        <Modal
          title="导入旧简历"
          className="import-modal"
          onClose={() => setShowImport(false)}
        >
          <div className="import-modal-status">
            <div className="parse-summary">
              <span className="success-icon">{parsedImport ? "✓" : "…"}</span>
              <div>
                <strong>{importFileName}</strong>
                <p>{importStatus}</p>
              </div>
            </div>
            {!parsedImport && importProgress > 0 && (
              <div className="import-progress">
                <i><b style={{ width: `${importProgress}%` }} /></i>
                <span>{importProgress}%</span>
              </div>
            )}
          </div>
          <div
            className="import-modal-scroll"
            tabIndex={0}
            aria-label="导入字段校对内容"
          >
            {parsedImport && (
              <>
              <div className="parse-tags">
                {[
                  ["基本信息", Boolean(parsedImport.name || parsedImport.email || parsedImport.phone)],
                  ["教育经历", Boolean(parsedImport.education)],
                  ["实习经历", Boolean(parsedImport.experience)],
                  ["项目经历", Boolean(parsedImport.project)],
                  ["校园经历", Boolean(parsedImport.campus)],
                  ["技能", Boolean(parsedImport.skills)],
                  ["证书", Boolean(parsedImport.certificate)],
                  ["作品链接", Boolean(parsedImport.portfolio)],
                ].map(([tag, found]) => (
                  <span className={found ? "" : "missing"} key={String(tag)}>
                    {found ? "✓" : "—"} {tag}
                  </span>
                ))}
              </div>
              <details className="import-text-preview">
                <summary>查看提取到的原始文字</summary>
                <pre>{parsedImport.rawText}</pre>
              </details>
              <details className="import-mapping" open>
                <summary>校对字段映射（推荐）</summary>
                <div className="import-basic-grid">
                  {([
                    ["name", "姓名"],
                    ["email", "邮箱"],
                    ["phone", "手机号"],
                    ["city", "所在城市"],
                  ] as [keyof ParsedResumeText, string][]).map(([field, label]) => (
                    <label className="field" key={field}>
                      <span>{label}</span>
                      <input
                        value={parsedImport[field]}
                        onChange={(event) =>
                          updateParsedImport(field, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
                {([
                  ["summary", "个人简介"],
                  ["education", "教育经历"],
                  ["experience", "实习 / 工作经历"],
                  ["project", "项目经历"],
                  ["campus", "校园经历"],
                  ["skills", "技能特长"],
                  ["certificate", "证书荣誉"],
                  ["evaluation", "自我评价"],
                  ["portfolio", "作品链接"],
                ] as [keyof ParsedResumeText, string][]).map(([field, label]) => (
                  <label className="field" key={field}>
                    <span>{label}</span>
                    <textarea
                      rows={field === "experience" || field === "project" ? 5 : 3}
                      value={parsedImport[field]}
                      onChange={(event) =>
                        updateParsedImport(field, event.target.value)
                      }
                      placeholder={`未识别到${label}时，可从上方原始文字复制到这里`}
                    />
                  </label>
                ))}
              </details>
              </>
            )}
            <p className="modal-note">
              文件只在当前浏览器中解析。双栏、表格和扫描件仍可能出现错序，请先校对字段映射再导入。
            </p>
          </div>
          <div className="modal-actions import-modal-actions">
            <button className="btn ghost" onClick={() => setShowImport(false)}>
              取消
            </button>
            <button className="btn primary" onClick={confirmImport} disabled={!parsedImport}>
              {parsedImport
                ? "导入并校对"
                : importStatus.startsWith("正在")
                  ? "正在解析…"
                  : "无法导入"}
            </button>
          </div>
        </Modal>
      )}

      {showVersion && (
        <Modal
          title={view === "optimize" ? "保存为 JD 定向版本" : "创建版本快照"}
          onClose={() => setShowVersion(false)}
        >
          <label className="field">
            <span>版本名称</span>
            <input
              value={versionName}
              onChange={(event) => setVersionName(event.target.value)}
            />
          </label>
          <div className="version-note">
            <span>原版本将完整保留</span>
            <p>新版本会记录本次修改，之后仍可选择任一历史版本进行匹配。</p>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setShowVersion(false)}>
              取消
            </button>
            <button
              className="btn primary"
              onClick={() => {
                if (view === "optimize") {
                  saveOptimizedVersion();
                } else {
                  saveSnapshot(versionName);
                  setToast("版本快照已创建");
                }
              }}
            >
              保存新版本
            </button>
          </div>
        </Modal>
      )}

      {showHistory && current && (
        <Modal title="历史版本" onClose={() => setShowHistory(false)}>
          <div className="history-head">
            <div>
              <strong>{current.name}</strong>
              <span>当前 V{current.version}</span>
            </div>
            <button
              className="btn secondary small"
              onClick={() => {
                setShowHistory(false);
                setVersionName(`${current.name} · 版本 ${current.version + 1}`);
                setShowVersion(true);
              }}
            >
              ＋ 保存当前版本
            </button>
          </div>
          <div className="history-list">
            {(histories[current.id] ?? []).length ? (
              (histories[current.id] ?? []).map((snapshot) => (
                <article key={snapshot.id}>
                  <div>
                    <strong>{snapshot.label}</strong>
                    <span>
                      V{snapshot.resume.version} · {snapshot.createdAt}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button onClick={() => restoreSnapshot(snapshot)}>恢复此版本</button>
                    <button onClick={() => deleteSnapshot(snapshot)}>删除</button>
                  </div>
                </article>
              ))
            ) : (
              <div className="history-empty">
                <span>暂无历史快照</span>
                <p>保存版本后，可在这里查看并恢复完整内容。</p>
              </div>
            )}
          </div>
          <p className="modal-note">恢复前会自动备份当前内容，不会覆盖或删除已有快照。</p>
        </Modal>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function AuthPage({
  mode,
  setMode,
  email,
  setEmail,
  password,
  setPassword,
  passwordConfirm,
  setPasswordConfirm,
  loading,
  message,
  submit,
}: {
  mode: "login" | "register";
  setMode: (value: "login" | "register") => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordConfirm: string;
  setPasswordConfirm: (value: string) => void;
  loading: boolean;
  message: string;
  submit: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span>知</span>
          <strong>知途</strong>
        </div>
        <div>
          <p className="eyebrow">校招简历助手</p>
          <h1>把每一次修改，都变成可找回的求职资产。</h1>
          <p>云端保存简历与历史版本，文件解析在浏览器中完成，不接入 AI。</p>
        </div>
        <ul>
          <li>真实 PDF、DOCX 与图片文字解析</li>
          <li>A4 实时预览与 PDF、PNG 导出</li>
          <li>岗位关键词本地规则匹配</li>
        </ul>
      </section>
      <section className="auth-card-wrap">
        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <span className="auth-mark">知</span>
          <div className="auth-tabs" role="tablist" aria-label="账号操作">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>
          <h2>{mode === "login" ? "欢迎回来" : "创建账号"}</h2>
          <p>
            {mode === "login"
              ? "使用邮箱和密码登录，继续编辑你的云端简历。"
              : "注册后即可保存简历与历史版本，无需打开邮件链接。"}
          </p>
          <label>
            <span>邮箱地址</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              autoFocus
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位字符"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
            />
          </label>
          {mode === "register" && (
            <label>
              <span>确认密码</span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                minLength={8}
              />
            </label>
          )}
          <button className="btn primary" type="submit" disabled={loading}>
            {loading
              ? mode === "login"
                ? "正在登录…"
                : "正在注册…"
              : mode === "login"
                ? "登录"
                : "注册并进入"}
          </button>
          {message && <div className="auth-message">{message}</div>}
          <small>账号仅用于隔离和保存你的数据；简历正文不会被发送给 AI 服务。</small>
        </form>
      </section>
    </main>
  );
}

function Dashboard({
  resumes,
  histories,
  openResume,
  duplicateResume,
  deleteResume,
  openHistory,
  setShowNew,
  triggerImport,
  goJD,
}: {
  resumes: Resume[];
  histories: ResumeHistory;
  openResume: (id: string) => void;
  duplicateResume: (resume: Resume) => void;
  deleteResume: (resume: Resume) => void;
  openHistory: (id: string) => void;
  setShowNew: (value: boolean) => void;
  triggerImport: () => void;
  goJD: () => void;
}) {
  const displayName =
    resumes
      .map((resume) => resume.basic.name.trim())
      .find(Boolean) || "求职同学";
  const activities = deriveWorkspaceActivities(resumes, histories);

  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">工作台</p>
          <h1>你好，{displayName}</h1>
          <p>先把真实经历说清楚，再让每份简历更贴近目标岗位。</p>
        </div>
        <div className="header-actions">
          <button className="btn secondary" onClick={triggerImport}>
            导入旧简历
          </button>
          <button className="btn primary" onClick={() => setShowNew(true)}>
            ＋ 新建简历
          </button>
        </div>
      </header>

      <section className="journey-banner">
        <div className="journey-copy">
          <span className="ai-pill">本地求职工作流</span>
          <h2>从一份真实简历，走到一场有准备的面试</h2>
          <p>选择简历版本，解析目标 JD，再逐条确认优化建议。</p>
        </div>
        <div className="journey-steps">
          {[
            ["01", "完善简历"],
            ["02", "匹配岗位"],
            ["03", "确认优化"],
            ["04", "准备面试"],
          ].map(([number, label], index) => (
            <div className={index < 1 ? "journey-step done" : "journey-step"} key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>
        <button className="banner-action" onClick={goJD}>
          开始 JD 匹配 →
        </button>
      </section>

      <div className="section-heading">
        <div>
          <h2>我的简历</h2>
          <span>{resumes.length} 份简历 · 自动保存于本机</span>
        </div>
        <button className="text-button" onClick={() => setShowNew(true)}>
          ＋ 新建
        </button>
      </div>

      <div className="resume-grid">
        {resumes.map((resume, index) => (
          <article className="resume-card" key={resume.id}>
            <button
              className="resume-thumb"
              onClick={() => openResume(resume.id)}
              aria-label={`编辑 ${resume.name}`}
            >
              <span className="thumb-label">{index === 0 ? "主投" : "备选"}</span>
              <div className="mini-resume">
                <strong>{resume.basic.name || "你的姓名"}</strong>
                <small>{resume.basic.target || "求职目标"}</small>
                <i />
                <b>教育经历</b>
                <em />
                <em />
                <b>项目经历</b>
                <em />
                <em className="short" />
              </div>
            </button>
            <div className="resume-card-body">
              <div className="card-title-row">
                <div>
                  <h3>{resume.name}</h3>
                  <p>{resume.target}</p>
                </div>
                <span className="version-chip">V{resume.version}</span>
              </div>
              <div className="progress-row">
                <div>
                  <span style={{ width: `${resume.completion}%` }} />
                </div>
                <strong>{resume.completion}% 完整</strong>
              </div>
              <div className="card-meta">
                <span>最近编辑 {resume.updated}</span>
                <div>
                  <button onClick={() => openHistory(resume.id)}>历史</button>
                  <button onClick={() => duplicateResume(resume)}>复制</button>
                  <button
                    className="delete-resume-button"
                    aria-label={`删除简历 ${resume.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteResume(resume);
                    }}
                  >
                    删除简历
                  </button>
                  <button className="edit-link" onClick={() => openResume(resume.id)}>
                    继续编辑
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        <button className="new-resume-card" onClick={() => setShowNew(true)}>
          <span>＋</span>
          <strong>创建另一份定向简历</strong>
          <small>针对不同岗位调整内容重点</small>
        </button>
      </div>

      <div className="dashboard-lower">
        <section className="activity-panel">
          <div className="section-heading compact">
            <div>
              <h2>最近动态</h2>
              <span>你的简历变化都可追溯</span>
            </div>
          </div>
          {activities.length ? (
            activities.map((activity) => (
              <div className="activity-row" key={`${activity.resumeId}-${activity.id}`}>
                <span className="activity-dot" />
                <div>
                  <strong>{activity.label}</strong>
                  <small>{activity.resumeName} · {activity.createdAt}</small>
                </div>
                <em>版本</em>
              </div>
            ))
          ) : (
            <div className="activity-empty">
              暂无历史动态；保存版本后会显示在这里。
            </div>
          )}
        </section>

        <aside className="next-panel">
          <span className="panel-kicker">推荐下一步</span>
          <h3>用目标岗位检验这份简历</h3>
          <p>当前简历已具备完整项目经历，可以开始匹配。</p>
          <div className="next-score">
            <strong>88%</strong>
            <span>简历完整度</span>
          </div>
          <button className="btn dark" onClick={goJD}>
            分析目标 JD
          </button>
        </aside>
      </div>
    </div>
  );
}

function Editor({
  resume,
  activeModule,
  setActiveModule,
  template,
  setTemplate,
  saveStatus,
  updateCurrent,
  updateNested,
  moveModule,
  hideModule,
  restoreModule,
  renameModule,
  addCustomModule,
  updateCustomModule,
  deleteCustomModule,
  updateEntry,
  addEntry,
  duplicateEntry,
  deleteEntry,
  moveEntry,
  goDashboard,
  goJD,
  setShowVersion,
  historyCount,
  showHistory,
  notify,
}: {
  resume: Resume;
  activeModule: ModuleKey;
  setActiveModule: (key: ModuleKey) => void;
  template: Template;
  setTemplate: (value: Template) => void;
  saveStatus: string;
  updateCurrent: (patch: Partial<Resume>) => void;
  updateNested: (
    key: "basic",
    field: string,
    value: string,
  ) => void;
  moveModule: (key: ModuleKey, direction: -1 | 1) => void;
  hideModule: (key: ModuleKey) => void;
  restoreModule: (key: ModuleKey) => void;
  renameModule: (key: ModuleKey, title: string) => void;
  addCustomModule: (title: string) => void;
  updateCustomModule: (key: CustomModuleKey, content: string) => void;
  deleteCustomModule: (key: CustomModuleKey) => void;
  updateEntry: (
    collection: EntryCollection,
    id: string,
    patch: Record<string, string>,
  ) => void;
  addEntry: (collection: EntryCollection) => void;
  duplicateEntry: (
    collection: EntryCollection,
    id: string,
  ) => void;
  deleteEntry: (
    collection: EntryCollection,
    id: string,
  ) => void;
  moveEntry: (
    collection: EntryCollection,
    id: string,
    direction: -1 | 1,
  ) => void;
  goDashboard: () => void;
  goJD: () => void;
  setShowVersion: (value: boolean) => void;
  historyCount: number;
  showHistory: () => void;
  notify: (message: string) => void;
}) {
  const [smartOnePage, setSmartOnePage] = useState(true);
  const [fitsOnePage, setFitsOnePage] = useState(true);
  const [density, setDensity] = useState<ResumeDensity>("normal");
  const layoutDensity = effectiveResumeDensity(smartOnePage, density);
  const [pageCount, setPageCount] = useState(1);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [previewPageUrls, setPreviewPageUrls] = useState<string[]>([]);
  const [previewPageHashes, setPreviewPageHashes] = useState<string[]>([]);
  const [previewZoom, setPreviewZoom] = useState({ zoom: 100, fitWidth: true });
  const [exportOpen, setExportOpen] = useState(false);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const paperRef = useRef<HTMLElement>(null);
  const paperStageRef = useRef<HTMLDivElement>(null);
  const sharedPreviewRef = useRef<{
    revision: number;
    render: SharedPreviewRender;
  } | null>(null);
  const previewPageUrlsRef = useRef<string[]>([]);
  const previewGenerationRef = useRef(0);
  const paginationCycleRef = useRef({
    input: "",
    exhausted: false,
    relaxedRejected: false,
    generation: 0,
  });
  const paginationInput = useMemo(
    () => JSON.stringify([resume, template, smartOnePage]),
    [resume, template, smartOnePage],
  );

  useEffect(() => {
    let validationFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      const paper = paperRef.current;
      if (paper) {
        const cycle = paginationCycleRef.current;
        const inputChanged = cycle.input !== paginationInput;
        if (inputChanged) {
          cycle.input = paginationInput;
          cycle.exhausted = false;
          cycle.relaxedRejected = false;
          cycle.generation += 1;
          if (density !== "normal") {
            setDensity("normal");
            return;
          }
        }
        const measurementGeneration = cycle.generation;

        paper.style.setProperty("--resume-pages", "1");
        const a4PageHeight = 610 * (297 / 210);
        const pageTopPadding =
          layoutDensity === "relaxed"
            ? 50
            : layoutDensity === "ultra"
              ? 24
              : layoutDensity === "compact"
                ? 31
                : 38;
        const pageBottomPadding = pageTopPadding / 2;
        const usablePageHeight =
          a4PageHeight - pageTopPadding - pageBottomPadding;
        const blocks = Array.from(
          paper.querySelectorAll<HTMLElement>("[data-pagination-block]"),
        );

        blocks.forEach((block) => {
          block.style.marginTop = "";
        });

        const measurements = blocks.map((block, index) => {
          const blockTop = block.offsetTop;
          const blockHeight = block.offsetHeight;
          const blockKind = block.dataset.paginationKind;
          // 正文只保护开头约两行，剩余内容允许自然跨页，避免整段搬移后留下大块空白。
          let keepTogetherHeight =
            blockKind === "entry-body" || block.tagName === "P"
              ? Math.min(blockHeight, 48)
              : blockHeight;
          if (blockKind === "heading" || blockKind === "entry-head") {
            const nextBlock = blocks[index + 1];
            if (nextBlock) {
              keepTogetherHeight =
                nextBlock.offsetTop +
                Math.min(nextBlock.offsetHeight, blockKind === "heading" ? 72 : 48) -
                blockTop;
            }
          }

          return {
            block,
            blockTop,
            blockHeight,
            keepTogetherHeight,
            baseMargin:
              Number.parseFloat(window.getComputedStyle(block).marginTop) || 0,
          };
        });

        const naturalBottom =
          measurements.reduce(
            (maximum, item) =>
              Math.max(maximum, item.blockTop + item.blockHeight),
            0,
          ) + pageBottomPadding;
        const naturallyFits = naturalBottom <= a4PageHeight + 2;

        if (smartOnePage) {
          const decision = decideSmartLayout({
            density,
            fitsOnePage: naturallyFits,
            fillRatio: naturalBottom / a4PageHeight,
            relaxedRejected: cycle.relaxedRejected,
            exhausted: cycle.exhausted,
          });
          cycle.relaxedRejected = decision.relaxedRejected;
          cycle.exhausted = decision.exhausted;
          if (decision.density !== density) {
            setDensity(decision.density);
            return;
          }
        }

        let cumulativeShift = 0;
        const placements: Array<{
          block: HTMLElement;
          marginTop: number;
        }> = [];

        measurements.forEach((item) => {
          const adjustedTop = item.blockTop + cumulativeShift;
          const currentPage = Math.floor(adjustedTop / a4PageHeight);
          const safePageTop = currentPage * a4PageHeight + pageTopPadding;
          const safePageBottom =
            (currentPage + 1) * a4PageHeight - pageBottomPadding;
          const startsInsideTopMargin =
            currentPage > 0 && adjustedTop < safePageTop;
          const crossesBottomMargin =
            adjustedTop + item.keepTogetherHeight > safePageBottom &&
            item.keepTogetherHeight <= usablePageHeight;

          if (startsInsideTopMargin || crossesBottomMargin) {
            const targetPage = startsInsideTopMargin
              ? currentPage
              : currentPage + 1;
            const targetTop = targetPage * a4PageHeight + pageTopPadding;
            const shift = Math.max(0, targetTop - adjustedTop);
            if (shift > 0) {
              cumulativeShift += shift;
              placements.push({
                block: item.block,
                marginTop: item.baseMargin + shift,
              });
            }
          }
        });

        // 先完成全部读取与计算，再统一写入，避免前一块位移污染后续坐标。
        placements.forEach(({ block, marginTop }) => {
          block.style.marginTop = `${marginTop}px`;
        });

        validationFrame = window.requestAnimationFrame(() => {
          if (
            paginationCycleRef.current.generation !== measurementGeneration
          ) {
            return;
          }
          const finalBottom =
            blocks.reduce(
              (maximum, block) =>
                Math.max(maximum, block.offsetTop + block.offsetHeight),
              0,
            ) + pageBottomPadding;
          const pages = Math.max(
            1,
            Math.ceil((finalBottom - 1) / a4PageHeight),
          );
          paper.style.setProperty("--resume-pages", String(pages));
          setPageCount((current) => (current === pages ? current : pages));
          setFitsOnePage(pages === 1);
          setLayoutRevision((current) => current + 1);
        });
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(validationFrame);
    };
  }, [density, layoutDensity, paginationInput, smartOnePage]);

  const toggleSmartOnePage = () => {
    if (smartOnePage) {
      const cycle = paginationCycleRef.current;
      cycle.input = "";
      cycle.exhausted = false;
      cycle.relaxedRejected = false;
      cycle.generation += 1;
      setDensity("normal");
    }
    setSmartOnePage((value) => !value);
  };

  const safeFilename =
    resume.name.replace(/[<>:"/\\|?*]/g, "-").trim() || "我的简历";

  // Retained as a compatibility fallback while the shared raster renderer is active.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderResumeCanvas = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1240;
    canvas.height = 1754 * Math.max(1, pageCount);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    const avatarImage = resume.basic.avatar
      ? await new Promise<HTMLImageElement | null>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = resume.basic.avatar;
        })
      : null;

    const scale = canvas.width / 610;
    const px = (value: number) => value * scale;
    const accent =
      template === "azure" ? "#315e88" : template === "sidebar" ? "#225e45" : "#1e2722";
    const relaxed = layoutDensity === "relaxed";
    const smart = layoutDensity === "compact" || layoutDensity === "ultra";
    const compact = layoutDensity === "compact";
    const ultra = layoutDensity === "ultra";
    const bodyFontSize = px(resume.fontSize * (4 / 3));
    const sectionHeadingFontSize = px(resume.headingFontSize * (4 / 3));
    const bodyLineHeight = px(
      resume.fontSize *
        (4 / 3) *
        (ultra ? 1.2 : compact ? 1.35 : relaxed ? 1.72 : 1.6),
    );
    const summaryLineHeight = px(
      resume.fontSize *
        (4 / 3) *
        (ultra ? 1.22 : compact ? 1.35 : relaxed ? 1.68 : 1.55),
    );
    const horizontalPadding = ultra ? 30 : compact ? 37 : relaxed ? 50 : 43;
    const sideWidth =
      template === "sidebar" ? px(smart ? 130 : relaxed ? 150 : 141) : 0;
    const contentX =
      template === "sidebar"
        ? px(smart ? 158 : relaxed ? 184 : 171)
        : px(horizontalPadding);
    const rightPadding = px(horizontalPadding);
    const contentWidth = canvas.width - contentX - rightPadding;
    const verticalPadding = ultra ? 24 : compact ? 31 : relaxed ? 50 : 38;
    let y = px(verticalPadding);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textBaseline = "top";
    if (template === "sidebar") {
      context.fillStyle = "#1b4334";
      context.fillRect(0, 0, sideWidth, canvas.height);
    }

    const setFont = (size: number, weight = 400) => {
      context.font = `${weight} ${size}px "Microsoft YaHei", "微软雅黑", "PingFang SC", Arial, sans-serif`;
    };
    const layoutFormattedLines = (
      value: string,
      size: number,
      weight: number,
      maxWidth: number,
    ) => {
      const lines: { text: string; bold: boolean }[][] = [];
      let line: { text: string; bold: boolean }[] = [];
      let lineWidth = 0;
      const flushLine = () => {
        lines.push(line.length ? line : [{ text: "", bold: false }]);
        line = [];
        lineWidth = 0;
      };
      formattedSegments(value).forEach((segment) => {
        Array.from(segment.text).forEach((character) => {
          if (character === "\n") {
            flushLine();
            return;
          }
          setFont(size, segment.bold ? 700 : weight);
          const characterWidth = context.measureText(character).width;
          if (line.length && lineWidth + characterWidth > maxWidth) {
            flushLine();
          }
          const previous = line[line.length - 1];
          if (previous && previous.bold === segment.bold) {
            previous.text += character;
          } else {
            line.push({ text: character, bold: segment.bold });
          }
          lineWidth += characterWidth;
        });
      });
      if (line.length || !lines.length) flushLine();
      return lines;
    };
    const drawWrapped = (
      value: string,
      size: number,
      weight: number,
      color: string,
      lineHeight: number,
      x = contentX,
      maxWidth = contentWidth,
    ) => {
      context.fillStyle = color;
      layoutFormattedLines(value, size, weight, maxWidth).forEach((line) => {
        let cursorX = x;
        line.forEach((run) => {
          setFont(size, run.bold ? 700 : weight);
          context.fillText(run.text, cursorX, y);
          cursorX += context.measureText(run.text).width;
        });
        y += lineHeight;
      });
    };
    const countWrappedLines = (value: string, maxWidth: number) => {
      const fontSize = Number.parseFloat(
        context.font.match(/([\d.]+)px/)?.[1] || "12",
      );
      return layoutFormattedLines(value, fontSize, 400, maxWidth).length;
    };
    const drawSectionHeading = (heading: string) => {
      y += px(ultra ? 4 : compact ? 8 : 11);
      setFont(sectionHeadingFontSize, 800);
      context.fillStyle = accent;
      context.fillText(heading, contentX, y);
      y += px(ultra ? 19 : compact ? 22 : 25);
      context.fillStyle = accent;
      context.fillRect(contentX, y - px(3), contentWidth, template === "azure" ? 3 : 2);
    };
    const drawEntry = (
      title: string,
      subtitle: string,
      period: string,
      description: string,
    ) => {
      setFont(bodyFontSize, 700);
      context.fillStyle = "#161916";
      context.fillText(title || "待填写", contentX, y);
      setFont(bodyFontSize, 400);
      const periodWidth = context.measureText(period).width;
      context.fillText(period, contentX + contentWidth - periodWidth, y);
      y += bodyFontSize * 1.3;
      if (subtitle) {
        drawWrapped(
          subtitle,
          bodyFontSize,
          700,
          "#161916",
          bodyLineHeight,
        );
      }
      if (description) {
        y += px(1);
        drawWrapped(
          description,
          bodyFontSize,
          400,
          "#252b27",
          bodyLineHeight,
        );
      }
      y += px(3);
    };

    if (template === "azure") {
      const headerHeight = px(smart ? 111 : 118);
      context.fillStyle = "#1d3554";
      context.fillRect(0, 0, canvas.width, headerHeight);
      y = px(smart ? 25 : 30);
    }
    setFont(px(23), 500);
    context.fillStyle = template === "azure" ? "#ffffff" : "#161916";
    context.fillText(resume.basic.name || "你的姓名", contentX, y);
    y += px(34);
    drawWrapped(
      resume.basic.target || resume.target,
      bodyFontSize,
      700,
      template === "azure" ? "#d4e0ec" : "#39594a",
      bodyLineHeight,
    );
    if (template !== "sidebar") {
      y += px(1);
      drawWrapped(
        [resume.basic.phone, resume.basic.email, resume.basic.city]
          .filter(Boolean)
          .join("  |  "),
        bodyFontSize,
        400,
        template === "azure" ? "#d4e0ec" : "#545d58",
        bodyLineHeight,
      );
    } else {
      let sideY = px(130);
      setFont(bodyFontSize, 400);
      context.fillStyle = "#e0eee7";
      [resume.basic.phone, resume.basic.email, resume.basic.city]
        .filter(Boolean)
        .forEach((line) => {
          context.fillText(line, px(13), sideY);
          sideY += bodyLineHeight;
        });
    }
    const avatarX =
      template === "sidebar"
        ? px(30)
        : canvas.width - rightPadding - px(53);
    const avatarY =
      template === "azure"
        ? px(ultra ? 20 : compact ? 25 : 30)
        : px(verticalPadding);
    const avatarWidth = px(template === "sidebar" ? 70 : 53);
    const avatarHeight = px(template === "sidebar" ? 70 : 63);
    context.fillStyle = "#e8d3c2";
    context.fillRect(avatarX, avatarY, avatarWidth, avatarHeight);
    if (avatarImage) {
      context.save();
      if (template === "sidebar") {
        context.beginPath();
        context.ellipse(
          avatarX + avatarWidth / 2,
          avatarY + avatarHeight / 2,
          avatarWidth / 2,
          avatarHeight / 2,
          0,
          0,
          Math.PI * 2,
        );
        context.clip();
      }
      const sourceRatio = avatarImage.naturalWidth / avatarImage.naturalHeight;
      const targetRatio = avatarWidth / avatarHeight;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = avatarImage.naturalWidth;
      let sourceHeight = avatarImage.naturalHeight;
      if (sourceRatio > targetRatio) {
        sourceWidth = avatarImage.naturalHeight * targetRatio;
        sourceX = (avatarImage.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = avatarImage.naturalWidth / targetRatio;
        sourceY = (avatarImage.naturalHeight - sourceHeight) / 2;
      }
      context.drawImage(
        avatarImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        avatarX,
        avatarY,
        avatarWidth,
        avatarHeight,
      );
      context.restore();
    } else {
      setFont(px(20), 700);
      context.fillStyle = "#714d39";
      const avatarText = resume.basic.name?.slice(0, 1) || "你";
      const avatarTextWidth = context.measureText(avatarText).width;
      context.fillText(
        avatarText,
        avatarX + (avatarWidth - avatarTextWidth) / 2,
        avatarY + (avatarHeight - px(20)) / 2,
      );
    }
    if (template === "azure") y = px(ultra ? 123 : compact ? 127 : 132);
    else y += px(ultra ? 4 : compact ? 6 : 8);
    if (resume.basic.summary.trim()) {
      const summaryStart = y;
      const summaryFont = bodyFontSize;
      const summaryTextWidth = contentWidth - px(18);
      setFont(summaryFont, 400);
      const summaryLines = countWrappedLines(
        resume.basic.summary,
        summaryTextWidth,
      );
      const summaryHeight = px(11) + summaryLines * summaryLineHeight;
      context.fillStyle = template === "azure" ? "#f3f7fb" : "#f1f6f3";
      context.fillRect(contentX, summaryStart, contentWidth, summaryHeight);
      context.fillStyle = template === "azure" ? "#557fad" : template === "sidebar" ? "#d2e987" : "#1e684c";
      context.fillRect(contentX, summaryStart, px(3), summaryHeight);
      y = summaryStart + px(6);
      drawWrapped(
        resume.basic.summary,
        summaryFont,
        400,
        "#48534d",
        summaryLineHeight,
        contentX + px(9),
        summaryTextWidth,
      );
      y += px(5);
    }
    resume.moduleOrder
      .filter((key) => key !== "basic" && isPreviewModuleVisible(resume, key))
      .forEach((key) => {
        drawSectionHeading(moduleLabel(resume, key));
        if (key === "experience") {
          resume.experiences.filter(isMeaningfulResumeEntry).forEach((item) =>
            drawEntry(item.company, item.role, item.period, item.description),
          );
          return;
        }
        if (key === "education") {
          resume.educations.filter(isMeaningfulResumeEntry).forEach((item) =>
            drawEntry(
              item.school,
              [item.major, item.degree].filter(Boolean).join(" · "),
              item.period,
              item.detail,
            ),
          );
          return;
        }
        if (key === "project") {
          resume.projects.filter(isMeaningfulResumeEntry).forEach((item) =>
            drawEntry(
              item.name,
              [item.role, item.stack].filter(Boolean).join(" · "),
              item.period,
              item.description,
            ),
          );
          return;
        }
        if (key === "campus") {
          resume.campusExperiences.filter(isMeaningfulResumeEntry).forEach((item) =>
            drawEntry(
              item.department,
              "",
              item.period,
              item.description,
            ),
          );
          return;
        }
        const text = isStandardModuleKey(key)
          ? key === "skills"
            ? resume.skills
            : key === "certificate"
              ? resume.certificate
              : key === "evaluation"
                ? resume.evaluation
                : key === "portfolio"
                  ? resume.portfolio
                  : ""
          : resume.customModules.find((item) => item.id === key)?.content || "";
        y += px(3);
        drawWrapped(
          text,
          bodyFontSize,
          400,
          "#252b27",
          bodyLineHeight,
        );
      });
    return canvas;
  };

  const renderPreviewPageCanvases = async () => {
    const sourcePaper = paperRef.current;
    if (!sourcePaper) throw new Error("Resume preview is unavailable");

    await document.fonts.ready;
    await Promise.all(
      Array.from(sourcePaper.querySelectorAll("img")).map((image) =>
        image.complete
          ? Promise.resolve()
          : image.decode().catch(() => undefined),
      ),
    );

    const paperWidth = 610;
    const pageHeight = paperWidth * (297 / 210);
    const pages = Math.max(1, pageCount);
    const totalHeight = pageHeight * pages;
    const renderScale = 3;
    const pagePixelWidth = Math.round(paperWidth * renderScale);
    const pagePixelHeight = Math.round(pageHeight * renderScale);

    const clone = sourcePaper.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".paper-page-break").forEach((marker) => marker.remove());
    clone.style.width = `${paperWidth}px`;
    clone.style.minWidth = `${paperWidth}px`;
    clone.style.maxWidth = `${paperWidth}px`;
    clone.style.height = `${totalHeight}px`;
    clone.style.minHeight = `${totalHeight}px`;
    clone.style.margin = "0";
    clone.style.boxShadow = "none";
    clone.style.setProperty("--resume-pages", String(pages));
    // SVG foreignObject rendering can resolve point units and `normal`
    // line-heights with different font metrics from the live HTML document.
    // Freeze every text node to the browser-computed pixel values before
    // rasterization so those small differences cannot accumulate by section.
    clone.style.setProperty(
      "--resume-body-font-size",
      window.getComputedStyle(sourcePaper).fontSize,
    );
    const sourceTextNodes = [
      sourcePaper,
      ...Array.from(sourcePaper.querySelectorAll<HTMLElement>("*")),
    ];
    const clonedTextNodes = [
      clone,
      ...Array.from(clone.querySelectorAll<HTMLElement>("*")),
    ];
    sourceTextNodes.forEach((sourceNode, index) => {
      const clonedNode = clonedTextNodes[index];
      if (!clonedNode) return;
      const computed = window.getComputedStyle(sourceNode);
      clonedNode.style.fontFamily = computed.fontFamily;
      clonedNode.style.fontSize = computed.fontSize;
      clonedNode.style.fontStyle = computed.fontStyle;
      clonedNode.style.fontWeight = computed.fontWeight;
      clonedNode.style.letterSpacing = computed.letterSpacing;
      clonedNode.style.lineHeight = computed.lineHeight;
      clonedNode.style.wordSpacing = computed.wordSpacing;
    });

    const stylesheetText = Array.from(document.styleSheets)
      .map((stylesheet) => {
        try {
          return Array.from(stylesheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n")
      // The preview follows the CSS screen conversion of 1pt = 4/3px. Convert
      // remaining point values before the stylesheet enters SVG so the image
      // decoder cannot reinterpret them as smaller physical units.
      .replace(
        /(-?(?:\d+|\d*\.\d+))pt\b/gi,
        (_, value: string) => `${Number.parseFloat(value) * (4 / 3)}px`,
      )
      .replaceAll("]]>", "]]]]><![CDATA[>");
    const serializedPaper = new XMLSerializer().serializeToString(clone);
    const svg = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${paperWidth}" height="${totalHeight}" viewBox="0 0 ${paperWidth} ${totalHeight}">`,
      `<foreignObject width="${paperWidth}" height="${totalHeight}">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${paperWidth}px;height:${totalHeight}px;overflow:hidden;background:#fff">`,
      `<style><![CDATA[${stylesheetText}]]></style>`,
      serializedPaper,
      "</div></foreignObject></svg>",
    ].join("");
    const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Preview snapshot failed"));
      value.src = imageUrl;
    });
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = pagePixelWidth;
    fullCanvas.height = pagePixelHeight * pages;
    const fullContext = fullCanvas.getContext("2d");
    if (!fullContext) throw new Error("Canvas is unavailable");
    fullContext.fillStyle = "#ffffff";
    fullContext.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    fullContext.drawImage(image, 0, 0, fullCanvas.width, fullCanvas.height);

    return Array.from({ length: pages }, (_, pageIndex) => {
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = pagePixelWidth;
      pageCanvas.height = pagePixelHeight;
      const pageContext = pageCanvas.getContext("2d");
      if (!pageContext) throw new Error("Canvas is unavailable");
      pageContext.fillStyle = "#ffffff";
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageContext.drawImage(
        fullCanvas,
        0,
        pageIndex * pagePixelHeight,
        pagePixelWidth,
        pagePixelHeight,
        0,
        0,
        pagePixelWidth,
        pagePixelHeight,
      );
      return pageCanvas;
    });
  };

  const createSharedPreviewRender = async (): Promise<SharedPreviewRender> => {
    const canvases = await renderPreviewPageCanvases();
    const encoded = await Promise.all(
      canvases.map(
        (canvas) =>
          new Promise<{ blob: Blob; page: VisualPdfPage }>((resolve, reject) => {
          canvas.toBlob(
            async (blob) => {
              if (!blob) {
                reject(new Error("JPEG encoding failed"));
                return;
              }
              const buffer = await blob.arrayBuffer();
              const digest = await crypto.subtle.digest("SHA-256", buffer);
              resolve({
                blob,
                page: {
                  jpeg: new Uint8Array(buffer),
                  width: canvas.width,
                  height: canvas.height,
                  sha256: Array.from(new Uint8Array(digest), (byte) =>
                    byte.toString(16).padStart(2, "0"),
                  ).join(""),
                },
              });
              },
              "image/jpeg",
              0.97,
            );
          }),
      ),
    );
    return {
      canvases,
      pages: encoded.map(({ page }) => page),
      urls: encoded.map(({ blob }) => URL.createObjectURL(blob)),
    };
  };

  const commitSharedPreviewRender = (
    revision: number,
    generation: number,
    render: SharedPreviewRender,
  ) => {
    if (generation !== previewGenerationRef.current) {
      render.urls.forEach((url) => URL.revokeObjectURL(url));
      return false;
    }
    previewPageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewPageUrlsRef.current = render.urls;
    sharedPreviewRef.current = { revision, render };
    setPreviewPageUrls(render.urls);
    setPreviewPageHashes(render.pages.map(({ sha256 }) => sha256));
    return true;
  };

  const refreshSharedPreview = async (revision: number) => {
    const generation = previewGenerationRef.current + 1;
    previewGenerationRef.current = generation;
    const render = await createSharedPreviewRender();
    commitSharedPreviewRender(revision, generation, render);
    return render;
  };

  const ensureSharedPreview = async () => {
    const current = sharedPreviewRef.current;
    if (current?.revision === layoutRevision) return current.render;
    return refreshSharedPreview(layoutRevision);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1200);
  };

  const exportPDF = async () => {
    setExportOpen(false);
    notify("正在生成与预览一致的高清 PDF…");
    try {
      const { pages } = await ensureSharedPreview();
      downloadBlob(
        new Blob([buildVisualPdf(pages)], { type: "application/pdf" }),
        `${safeFilename}-A4.pdf`,
      );
      notify("高清 A4 PDF 已下载");
    } catch (error) {
      console.error("PDF export failed", error);
      notify("PDF 生成失败，请稍后重试");
    }
  };

  const exportPNG = async () => {
    setExportOpen(false);
    notify("正在生成 A4 PNG…");
    try {
      const { canvases } = await ensureSharedPreview();
      const canvas =
        canvases.length === 1
          ? canvases[0]
          : (() => {
              const combined = document.createElement("canvas");
              combined.width = canvases[0].width;
              combined.height = canvases.reduce(
                (height, page) => height + page.height,
                0,
              );
              const context = combined.getContext("2d");
              if (!context) throw new Error("Canvas is unavailable");
              let y = 0;
              canvases.forEach((page) => {
                context.drawImage(page, 0, y);
                y += page.height;
              });
              return combined;
            })();
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error("PNG encoding failed")),
          "image/png",
        );
      });
      downloadBlob(blob, `${safeFilename}-A4.png`);
      notify("A4 PNG 已下载");
    } catch {
      notify("PNG 生成失败，请重试");
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSharedPreview(layoutRevision).catch((error) => {
        console.error("Shared preview render failed", error);
      });
    }, 80);
    return () => window.clearTimeout(timer);
    // The layout revision is the explicit signal that pagination and density
    // measurements have settled; render helpers intentionally stay outside
    // the dependency list to avoid regenerating on unrelated editor renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutRevision]);

  useEffect(
    () => () => {
      previewGenerationRef.current += 1;
      previewPageUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewPageUrlsRef.current = [];
    },
    [],
  );

  useEffect(() => {
    if (!previewZoom.fitWidth) return;
    const stage = paperStageRef.current;
    if (!stage) return;
    const updateFitWidth = () => {
      const style = window.getComputedStyle(stage);
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const zoom = calculateFitWidthZoom(stage.clientWidth, horizontalPadding);
      setPreviewZoom((state) =>
        state.fitWidth && state.zoom !== zoom ? { zoom, fitWidth: true } : state,
      );
    };
    updateFitWidth();
    const observer = new ResizeObserver(updateFitWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [previewZoom.fitWidth]);

  return (
    <div className="editor-page">
      <header className="editor-topbar">
        <div className="editor-title">
          <button onClick={goDashboard} aria-label="返回简历中心">←</button>
          <div>
            <input
              value={resume.name}
              onChange={(event) => updateCurrent({ name: event.target.value })}
              aria-label="简历名称"
            />
            <span><i /> {saveStatus}</span>
          </div>
        </div>
        <div className="editor-actions">
          <button
            className={smartOnePage ? "one-page-toggle active" : "one-page-toggle"}
            onClick={toggleSmartOnePage}
            aria-pressed={smartOnePage}
            title="自动调整页边距、行距和模块间距，优先保持一页"
          >
            <span>{smartOnePage ? "✓" : "1"}</span>
            智能一页
          </button>
          <label className="font-size-control">
            <span>正文字号</span>
            <select
              aria-label="简历正文字号"
              value={resume.fontSize}
              onChange={(event) =>
                updateCurrent({
                  fontSize: Number(event.target.value) as ResumeFontSize,
                })
              }
            >
              {RESUME_FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}pt
                </option>
              ))}
            </select>
          </label>
          <label className="font-size-control">
            <span>标题字号</span>
            <select
              aria-label="简历模块标题字号"
              value={resume.headingFontSize}
              onChange={(event) =>
                updateCurrent({
                  headingFontSize: Number(
                    event.target.value,
                  ) as ResumeHeadingFontSize,
                })
              }
            >
              {RESUME_HEADING_FONT_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}pt
                </option>
              ))}
            </select>
          </label>
          <div className="template-switch">
            <span>模板</span>
            <button
              className={template === "classic" ? "active" : ""}
              onClick={() => setTemplate("classic")}
            >
              经典
            </button>
            <button
              className={template === "azure" ? "active" : ""}
              onClick={() => setTemplate("azure")}
            >
              靛蓝
            </button>
            <button
              className={template === "sidebar" ? "active" : ""}
              onClick={() => setTemplate("sidebar")}
            >
              侧栏
            </button>
          </div>
          <button className="btn secondary small" onClick={() => setShowVersion(true)}>
            保存版本
          </button>
          <button className="btn secondary small history-button" onClick={showHistory}>
            历史 {historyCount > 0 ? `(${historyCount})` : ""}
          </button>
          <div className="export-control">
            <button
              className="btn export-button small"
              onClick={() => setExportOpen((value) => !value)}
              aria-expanded={exportOpen}
            >
              导出简历⌄
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={exportPDF}>
                  <span>PDF</span>
                  <div>
                    <strong>高清 A4 PDF</strong>
                    <small>锁定预览排版 · 直接下载</small>
                  </div>
                </button>
                <button onClick={exportPNG}>
                  <span>PNG</span>
                  <div>
                    <strong>导出 PNG</strong>
                    <small>与右侧预览一致 · A4</small>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button className="btn primary small" onClick={goJD}>JD 本地匹配</button>
        </div>
      </header>

      <div className="editor-workspace">
        <aside className="module-sidebar">
          <div className="module-sidebar-title">
            <div>
              <strong>简历模块</strong>
              <small>拖动思路 · 调整顺序</small>
            </div>
            <span>{resume.moduleOrder.length - resume.hiddenModules.length}</span>
          </div>
          <div className="module-list">
            {resume.moduleOrder
              .filter((key) => !resume.hiddenModules.includes(key))
              .map((key, index) => (
                <button
                  className={activeModule === key ? "module-item active" : "module-item"}
                  key={key}
                  onClick={() => setActiveModule(key)}
                >
                  <span className="module-icon">{moduleIcon(key)}</span>
                  <strong>{moduleLabel(resume, key)}</strong>
                  <span className="module-order">
                    <i
                      onClick={(event) => {
                        event.stopPropagation();
                        moveModule(key, -1);
                      }}
                      aria-label="上移"
                    >
                      ↑
                    </i>
                    <i
                      onClick={(event) => {
                        event.stopPropagation();
                        moveModule(key, 1);
                      }}
                      aria-label="下移"
                    >
                      ↓
                    </i>
                  </span>
                  <em>{index < 5 ? "✓" : ""}</em>
                </button>
              ))}
          </div>
          {resume.hiddenModules.length > 0 && (
            <div className="hidden-modules">
              <small>已隐藏模块</small>
              {resume.hiddenModules.map((key) => (
                <button key={key} onClick={() => restoreModule(key)}>
                  ＋ {moduleLabel(resume, key)}
                </button>
              ))}
            </div>
          )}
          <button
            className="add-module-button"
            onClick={() => setAddModuleOpen((value) => !value)}
            aria-expanded={addModuleOpen}
          >
            ＋ 添加简历模块
          </button>
          {addModuleOpen && (
            <div className="add-module-panel">
              {resume.hiddenModules.length > 0 && (
                <>
                  <small>恢复已隐藏模块</small>
                  <div className="add-module-options">
                    {resume.hiddenModules.map((key) => (
                      <button
                        key={key}
                        onClick={() => {
                          restoreModule(key);
                          setAddModuleOpen(false);
                        }}
                      >
                        ＋ {moduleLabel(resume, key)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label>
                <span>新建自定义模块</span>
                <input
                  value={newModuleName}
                  maxLength={24}
                  placeholder="例如：校园经历、志愿服务"
                  onChange={(event) => setNewModuleName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || !newModuleName.trim()) return;
                    addCustomModule(newModuleName);
                    setNewModuleName("");
                    setAddModuleOpen(false);
                  }}
                />
              </label>
              <button
                className="create-module-button"
                disabled={!newModuleName.trim()}
                onClick={() => {
                  addCustomModule(newModuleName);
                  setNewModuleName("");
                  setAddModuleOpen(false);
                }}
              >
                创建模块
              </button>
            </div>
          )}
          <div className="completion-card">
            <div>
              <strong>{resume.completion}%</strong>
              <span>完整度</span>
            </div>
            <p>再完善 2 项信息即可开始投递</p>
          </div>
        </aside>

        <section className="form-panel">
          <div className="form-panel-header">
            <div>
              <p className="eyebrow">正在编辑</p>
              {activeModule === "basic" ? (
                <h2>{moduleLabel(resume, activeModule)}</h2>
              ) : (
                <input
                  className="module-name-input"
                  value={moduleLabel(resume, activeModule)}
                  maxLength={24}
                  aria-label="模块名称"
                  onChange={(event) =>
                    renameModule(activeModule, event.target.value)
                  }
                />
              )}
              <span>填写真实信息，右侧将实时更新</span>
            </div>
            {activeModule !== "basic" && (
              <button
                className="danger-link"
                onClick={() => hideModule(activeModule)}
              >
                隐藏模块
              </button>
            )}
          </div>

          <ModuleForm
            resume={resume}
            activeModule={activeModule}
            updateCurrent={updateCurrent}
            updateNested={updateNested}
            updateEntry={updateEntry}
            addEntry={addEntry}
            duplicateEntry={duplicateEntry}
            deleteEntry={deleteEntry}
            moveEntry={moveEntry}
            updateCustomModule={updateCustomModule}
            deleteCustomModule={deleteCustomModule}
          />
        </section>

        <section className="preview-panel">
          <div className="preview-toolbar">
            <div>
              <span className="live-dot" />
              实时预览
              <span className="a4-badge">A4 · 210 × 297 mm</span>
            </div>
            <div className="preview-zoom-controls">
              <button
                aria-label="缩小简历预览"
                disabled={previewZoom.zoom <= PREVIEW_ZOOM_MIN}
                onClick={() => setPreviewZoom((state) => applyManualPreviewZoom(state, -1))}
              >−</button>
              <span aria-live="polite">{previewZoom.zoom}%</span>
              <button
                aria-label="放大简历预览"
                disabled={previewZoom.zoom >= PREVIEW_ZOOM_MAX}
                onClick={() => setPreviewZoom((state) => applyManualPreviewZoom(state, 1))}
              >＋</button>
              <button
                className={previewZoom.fitWidth ? "fit-button active" : "fit-button"}
                aria-pressed={previewZoom.fitWidth}
                onClick={() => {
                  const stage = paperStageRef.current;
                  if (!stage) return;
                  const style = window.getComputedStyle(stage);
                  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
                  setPreviewZoom({
                    zoom: calculateFitWidthZoom(stage.clientWidth, padding),
                    fitWidth: true,
                  });
                }}
              >适应宽度</button>
            </div>
          </div>
          <div className="paper-stage" ref={paperStageRef}>
            <div className="resume-render-source" aria-hidden="true">
              <ResumePreview
                resume={resume}
                template={template}
                paperRef={paperRef}
                density={layoutDensity}
                pageCount={pageCount}
              />
            </div>
            {previewPageUrls.length ? (
              <div
                className="shared-preview-pages"
                data-preview-zoom={previewZoom.zoom}
                style={
                  {
                    "--preview-width": `${(PREVIEW_A4_WIDTH_PX * previewZoom.zoom) / 100}px`,
                    "--preview-page-gap": `${(18 * previewZoom.zoom) / 100}px`,
                  } as React.CSSProperties
                }
              >
                {previewPageUrls.map((url, index) => (
                  <img
                    alt={`简历预览第 ${index + 1} 页`}
                    className="shared-preview-page"
                    data-page-sha256={previewPageHashes[index]}
                    draggable={false}
                    key={url}
                    src={url}
                  />
                ))}
              </div>
            ) : (
              <div className="shared-preview-loading" aria-live="polite">
                正在同步 A4 预览…
              </div>
            )}
            <div className="paper-status">
              <span>共 {pageCount} 页</span>
              <span>
                {smartOnePage
                  ? fitsOnePage
                    ? density === "relaxed"
                      ? "✓ 内容较少，已舒展间距"
                      : density === "normal"
                      ? "✓ 内容自然适配一页"
                      : density === "compact"
                        ? "✓ 已适度压缩为一页"
                        : "✓ 已最大压缩为一页"
                    : `内容较多，保持可读排版，共 ${pageCount} 页`
                  : pageCount === 1
                    ? "A4 标准排版"
                    : `内容较多，已自动扩展为 ${pageCount} 页`}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ModuleForm({
  resume,
  activeModule,
  updateCurrent,
  updateNested,
  updateEntry,
  addEntry,
  duplicateEntry,
  deleteEntry,
  moveEntry,
  updateCustomModule,
  deleteCustomModule,
}: {
  resume: Resume;
  activeModule: ModuleKey;
  updateCurrent: (patch: Partial<Resume>) => void;
  updateNested: (
    key: "basic",
    field: string,
    value: string,
  ) => void;
  updateEntry: (
    collection: EntryCollection,
    id: string,
    patch: Record<string, string>,
  ) => void;
  addEntry: (collection: EntryCollection) => void;
  duplicateEntry: (
    collection: EntryCollection,
    id: string,
  ) => void;
  deleteEntry: (
    collection: EntryCollection,
    id: string,
  ) => void;
  moveEntry: (
    collection: EntryCollection,
    id: string,
    direction: -1 | 1,
  ) => void;
  updateCustomModule: (key: CustomModuleKey, content: string) => void;
  deleteCustomModule: (key: CustomModuleKey) => void;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState("");

  const selectAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("请选择 JPG、PNG 或 WebP 图片");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError("图片不能超过 10 MB");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const outputWidth = 420;
      const outputHeight = 500;
      const scale = Math.max(
        outputWidth / bitmap.width,
        outputHeight / bitmap.height,
      );
      const sourceWidth = outputWidth / scale;
      const sourceHeight = outputHeight / scale;
      const sourceX = (bitmap.width - sourceWidth) / 2;
      const sourceY = (bitmap.height - sourceHeight) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法处理图片");
      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputWidth,
        outputHeight,
      );
      bitmap.close();
      updateNested("basic", "avatar", canvas.toDataURL("image/jpeg", 0.88));
      setAvatarError("");
    } catch {
      setAvatarError("头像处理失败，请换一张图片重试");
    }
  };

  if (activeModule === "basic") {
    return (
      <div className="form-stack">
        <div className="form-card">
          <div className="form-grid two">
            <Field label="姓名" value={resume.basic.name} onChange={(v) => updateNested("basic", "name", v)} />
            <Field label="求职目标" value={resume.basic.target} onChange={(v) => updateNested("basic", "target", v)} />
            <Field label="手机号" value={resume.basic.phone} onChange={(v) => updateNested("basic", "phone", v)} />
            <Field label="邮箱" value={resume.basic.email} onChange={(v) => updateNested("basic", "email", v)} />
            <Field label="所在城市" value={resume.basic.city} onChange={(v) => updateNested("basic", "city", v)} />
            <label className="field">
              <span>头像</span>
              <input
                ref={avatarInputRef}
                className="avatar-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={selectAvatar}
              />
              <div className="avatar-actions">
                <button
                  type="button"
                  className="upload-field"
                  onClick={() => avatarInputRef.current?.click()}
                >
                    <span className="avatar-thumb">
                      {resume.basic.avatar ? (
                        // 用户头像是本地 data URL，不能交给 Next Image 优化器。
                        <img src={resume.basic.avatar} alt="" />
                    ) : (
                      resume.basic.name?.slice(0, 1) || "你"
                    )}
                  </span>
                  <b>{resume.basic.avatar ? "更换头像" : "上传头像"}</b>
                </button>
                {resume.basic.avatar && (
                  <button
                    type="button"
                    className="avatar-remove"
                    onClick={() => updateNested("basic", "avatar", "")}
                  >
                    移除
                  </button>
                )}
              </div>
              {avatarError && <small className="field-error">{avatarError}</small>}
            </label>
          </div>
          <TextField
            label="个人简介"
            value={resume.basic.summary}
            onChange={(v) => updateNested("basic", "summary", v)}
            hint="建议用 2–3 句话概括专业背景、核心能力和求职方向。"
          />
        </div>
        <TruthNotice />
      </div>
    );
  }

  if (activeModule === "experience") {
    return (
      <div className="form-stack">
        {resume.experiences.map((entry, index) => (
          <div className="entry-block" key={entry.id}>
            <EntryToolbar
              label={`实习经历 ${String(index + 1).padStart(2, "0")}`}
              index={index}
              total={resume.experiences.length}
              duplicate={() => duplicateEntry("experiences", entry.id)}
              remove={() => deleteEntry("experiences", entry.id)}
              move={(direction) => moveEntry("experiences", entry.id, direction)}
            />
            <div className="form-card">
              <div className="form-grid two">
                <Field label="公司名称" value={entry.company} onChange={(v) => updateEntry("experiences", entry.id, { company: v })} />
                <Field label="职位" value={entry.role} onChange={(v) => updateEntry("experiences", entry.id, { role: v })} />
                <MonthRangePicker label="时间" value={entry.period} onChange={(v) => updateEntry("experiences", entry.id, { period: v })} />
              </div>
              <TextField
                label="职责与成果"
                value={entry.description}
                onChange={(v) => updateEntry("experiences", entry.id, { description: v })}
                rows={6}
              />
              <SmartHint />
            </div>
          </div>
        ))}
        <button className="add-entry" onClick={() => addEntry("experiences")}>＋ 添加一段实习经历</button>
        <TruthNotice />
      </div>
    );
  }

  if (activeModule === "education") {
    return (
      <div className="form-stack">
        {resume.educations.map((entry, index) => (
          <div className="entry-block" key={entry.id}>
            <EntryToolbar
              label={`教育经历 ${String(index + 1).padStart(2, "0")}`}
              index={index}
              total={resume.educations.length}
              duplicate={() => duplicateEntry("educations", entry.id)}
              remove={() => deleteEntry("educations", entry.id)}
              move={(direction) => moveEntry("educations", entry.id, direction)}
            />
            <div className="form-card">
              <div className="form-grid two">
                <Field label="学校" value={entry.school} onChange={(v) => updateEntry("educations", entry.id, { school: v })} />
                <Field label="专业" value={entry.major} onChange={(v) => updateEntry("educations", entry.id, { major: v })} />
                <Field label="学历" value={entry.degree} onChange={(v) => updateEntry("educations", entry.id, { degree: v })} />
                <MonthRangePicker label="时间" value={entry.period} onChange={(v) => updateEntry("educations", entry.id, { period: v })} />
              </div>
              <TextField label="成绩、排名与课程" value={entry.detail} onChange={(v) => updateEntry("educations", entry.id, { detail: v })} />
            </div>
          </div>
        ))}
        <button className="add-entry" onClick={() => addEntry("educations")}>＋ 添加教育经历</button>
      </div>
    );
  }

  if (activeModule === "project") {
    return (
      <div className="form-stack">
        {resume.projects.map((entry, index) => (
          <div className="entry-block" key={entry.id}>
            <EntryToolbar
              label={`项目经历 ${String(index + 1).padStart(2, "0")}`}
              index={index}
              total={resume.projects.length}
              duplicate={() => duplicateEntry("projects", entry.id)}
              remove={() => deleteEntry("projects", entry.id)}
              move={(direction) => moveEntry("projects", entry.id, direction)}
            />
            <div className="form-card">
              <div className="form-grid two">
                <Field label="项目名称" value={entry.name} onChange={(v) => updateEntry("projects", entry.id, { name: v })} />
                <Field label="个人角色" value={entry.role} onChange={(v) => updateEntry("projects", entry.id, { role: v })} />
                <MonthRangePicker label="项目时间" value={entry.period} onChange={(v) => updateEntry("projects", entry.id, { period: v })} />
                <Field label="技术栈" value={entry.stack} onChange={(v) => updateEntry("projects", entry.id, { stack: v })} />
              </div>
              <TextField label="项目背景、个人贡献与成果" value={entry.description} onChange={(v) => updateEntry("projects", entry.id, { description: v })} rows={6} />
              <SmartHint project />
            </div>
          </div>
        ))}
        <button className="add-entry" onClick={() => addEntry("projects")}>＋ 添加项目经历</button>
      </div>
    );
  }

  if (activeModule === "campus") {
    return (
      <div className="form-stack">
        {resume.campusExperiences.map((entry, index) => (
          <div className="entry-block" key={entry.id}>
            <EntryToolbar
              label={`校园经历 ${String(index + 1).padStart(2, "0")}`}
              index={index}
              total={resume.campusExperiences.length}
              duplicate={() => duplicateEntry("campusExperiences", entry.id)}
              remove={() => deleteEntry("campusExperiences", entry.id)}
              move={(direction) =>
                moveEntry("campusExperiences", entry.id, direction)
              }
            />
            <div className="form-card">
              <div className="form-grid two">
                <Field
                  label="部门"
                  value={entry.department}
                  onChange={(value) =>
                    updateEntry("campusExperiences", entry.id, {
                      department: value,
                    })
                  }
                />
                <MonthRangePicker
                  label="时间"
                  value={entry.period}
                  onChange={(value) =>
                    updateEntry("campusExperiences", entry.id, {
                      period: value,
                    })
                  }
                />
              </div>
              <TextField
                label="具体内容"
                value={entry.description}
                onChange={(value) =>
                  updateEntry("campusExperiences", entry.id, {
                    description: value,
                  })
                }
                rows={6}
              />
              <SmartHint />
            </div>
          </div>
        ))}
        <button
          className="add-entry"
          onClick={() => addEntry("campusExperiences")}
        >
          ＋ 添加一段校园经历
        </button>
        <TruthNotice />
      </div>
    );
  }

  if (!isStandardModuleKey(activeModule)) {
    const customModule = resume.customModules.find(
      (item) => item.id === activeModule,
    );
    if (!customModule) return null;
    return (
      <div className="form-stack">
        <div className="form-card">
          <TextField
            label="模块内容"
            value={customModule.content}
            onChange={(value) => updateCustomModule(activeModule, value)}
            rows={9}
            hint="只填写真实经历或补充信息；输入换行会同步保留在预览和导出中。"
          />
        </div>
        <button
          className="delete-custom-module"
          onClick={() => {
            if (window.confirm(`确定删除「${customModule.title}」模块吗？`)) {
              deleteCustomModule(activeModule);
            }
          }}
        >
          删除此自定义模块
        </button>
        <TruthNotice />
      </div>
    );
  }

  const simpleMap: Record<
    Exclude<
      StandardModuleKey,
      "basic" | "experience" | "education" | "project" | "campus"
    >,
    { label: string; hint: string; field: keyof Resume }
  > = {
    skills: {
      label: "技能名称与熟练程度",
      hint: "只填写真实掌握的技能。可用“熟悉 / 了解”描述程度。",
      field: "skills",
    },
    certificate: {
      label: "证书与荣誉",
      hint: "建议写明证书名称、颁发机构和获得时间。",
      field: "certificate",
    },
    evaluation: {
      label: "自我评价",
      hint: "避免“吃苦耐劳”等空泛描述，优先写可被经历证明的特质。",
      field: "evaluation",
    },
    portfolio: {
      label: "作品名称与链接",
      hint: "可添加 GitHub、个人网站、设计作品集或项目演示。",
      field: "portfolio",
    },
  };
  const config = simpleMap[activeModule as keyof typeof simpleMap];
  return (
    <div className="form-stack">
      <div className="form-card">
        <TextField
          label={config.label}
          value={String(resume[config.field])}
          onChange={(value) => updateCurrent({ [config.field]: value })}
          rows={6}
          hint={config.hint}
        />
      </div>
        <button className="add-entry">＋ 添加一项{moduleLabel(resume, activeModule)}</button>
      <TruthNotice />
    </div>
  );
}

function EntryToolbar({
  label,
  index,
  total,
  duplicate,
  remove,
  move,
}: {
  label: string;
  index: number;
  total: number;
  duplicate: () => void;
  remove: () => void;
  move: (direction: -1 | 1) => void;
}) {
  return (
    <div className="entry-label">
      <span>{label}</span>
      <div>
        <button onClick={() => move(-1)} disabled={index === 0} aria-label="上移">
          ↑
        </button>
        <button onClick={() => move(1)} disabled={index === total - 1} aria-label="下移">
          ↓
        </button>
        <button onClick={duplicate}>复制</button>
        <button className="entry-delete" onClick={remove}>删除</button>
      </div>
    </div>
  );
}

function ResumePreview({
  resume,
  template,
  paperRef,
  density,
  pageCount,
}: {
  resume: Resume;
  template: Template;
  paperRef: RefObject<HTMLElement | null>;
  density: ResumeDensity;
  pageCount: number;
}) {
  const visible = useMemo(
    () => visiblePreviewModuleKeys(resume),
    [resume],
  );
  return (
    <article
      ref={paperRef}
      className={`resume-paper template-${template} density-${density}${density === "compact" || density === "ultra" ? " smart-one-page" : ""}${density === "ultra" ? " ultra-compact" : ""}`}
      style={
        {
          "--resume-pages": pageCount,
          "--resume-body-font-size": `${resume.fontSize}pt`,
          "--resume-heading-font-size": `${resume.headingFontSize}pt`,
        } as React.CSSProperties
      }
    >
      {Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => (
        <span
          aria-hidden="true"
          className="paper-page-break"
          key={`page-break-${index + 1}`}
          style={{ "--page-index": index + 1 } as React.CSSProperties}
        />
      ))}
      <header className="paper-header" data-pagination-block>
        <div className="paper-identity">
          <h1>{resume.basic.name || "你的姓名"}</h1>
          {resume.basic.target.trim() && <p>{resume.basic.target}</p>}
          {[resume.basic.phone, resume.basic.email, resume.basic.city].some(
            (value) => value.trim(),
          ) && (
            <div>
              {[resume.basic.phone, resume.basic.email, resume.basic.city]
                .filter((value) => value.trim())
                .map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
            </div>
          )}
        </div>
        <div className="paper-avatar">
          {resume.basic.avatar ? (
            // 用户头像是本地 data URL，不能交给 Next Image 优化器。
            <img src={resume.basic.avatar} alt={`${resume.basic.name || "用户"}的头像`} />
          ) : (
            resume.basic.name?.slice(0, 1) || "你"
          )}
        </div>
      </header>
      {resume.basic.summary.trim() && (
        <p className="paper-summary" data-pagination-block>
          <FormattedText value={resume.basic.summary} />
        </p>
      )}
      <div className="paper-body">
        {visible
          .filter((key) => key !== "basic")
          .map((key) => (
            <section className={`paper-section section-${key}`} key={key}>
              <h2
                data-pagination-block
                data-pagination-kind="heading"
              >
                {moduleLabel(resume, key)}
              </h2>
              {key === "experience" &&
                resume.experiences.filter(isMeaningfulResumeEntry).map((entry) => (
                  <PaperEntry
                    key={entry.id}
                    title={entry.company}
                    subtitle={entry.role}
                    period={entry.period}
                    text={entry.description}
                  />
                ))}
              {key === "education" &&
                resume.educations.filter(isMeaningfulResumeEntry).map((entry) => (
                  <PaperEntry
                    key={entry.id}
                    title={entry.school}
                    subtitle={`${entry.major} · ${entry.degree}`}
                    period={entry.period}
                    text={entry.detail}
                  />
                ))}
              {key === "project" &&
                resume.projects.filter(isMeaningfulResumeEntry).map((entry) => (
                  <PaperEntry
                    key={entry.id}
                    title={entry.name}
                    subtitle={[entry.role, entry.stack].filter(Boolean).join(" · ")}
                    period={entry.period}
                    text={entry.description}
                  />
                ))}
              {key === "campus" &&
                resume.campusExperiences.filter(isMeaningfulResumeEntry).map((entry) => (
                  <PaperEntry
                    key={entry.id}
                    title={entry.department}
                    subtitle=""
                    period={entry.period}
                    text={entry.description}
                  />
                ))}
              {key === "skills" && <p data-pagination-block><FormattedText value={resume.skills} /></p>}
              {key === "certificate" && <p data-pagination-block><FormattedText value={resume.certificate} /></p>}
              {key === "evaluation" && <p data-pagination-block><FormattedText value={resume.evaluation} /></p>}
              {key === "portfolio" && <p data-pagination-block><FormattedText value={resume.portfolio} /></p>}
              {!isStandardModuleKey(key) && (
                <p data-pagination-block>
                  <FormattedText
                    value={
                      resume.customModules.find((item) => item.id === key)
                        ?.content || ""
                    }
                  />
                </p>
              )}
            </section>
          ))}
      </div>
    </article>
  );
}

function PaperEntry({
  title,
  subtitle,
  period,
  text,
}: {
  title: string;
  subtitle: string;
  period: string;
  text: string;
}) {
  return (
    <div className="paper-entry">
      <div data-pagination-block data-pagination-kind="entry-head">
        <div className="paper-entry-head">
          <strong>{title || "待填写"}</strong>
          <span>{period}</span>
        </div>
        {subtitle && <b>{subtitle}</b>}
      </div>
      <p data-pagination-block data-pagination-kind="entry-body">
        <FormattedText value={text} />
      </p>
    </div>
  );
}

function JDPage({
  resumes,
  currentId,
  setCurrentId,
  jdText,
  setJdText,
  analyzing,
  analysisReady,
  analysis,
  suggestionCount,
  suggestions,
  analyzeJD,
  analysisTab,
  setAnalysisTab,
  goOptimize,
}: {
  resumes: Resume[];
  currentId: string;
  setCurrentId: (id: string) => void;
  jdText: string;
  setJdText: (value: string) => void;
  analyzing: boolean;
  analysisReady: boolean;
  analysis: JDAnalysisResult | null;
  suggestionCount: number;
  suggestions: Suggestion[];
  analyzeJD: () => void;
  analysisTab: string;
  setAnalysisTab: (value: string) => void;
  goOptimize: () => void;
}) {
  const result = analysis ?? {
    keywords: [],
    matched: [],
    missing: [],
    evidence: [],
    coverageRatio: 0,
    coverageLabel: "未识别" as const,
    questions: [],
  };
  return (
    <div className="page jd-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">JD 本地规则匹配</p>
          <h1>看懂岗位，再调整简历</h1>
          <p>系统只引用简历中已有内容，未体现的能力会明确标记。本地规则，不代表企业筛选结果。</p>
        </div>
        {analysisReady && (
          <button className="btn primary" onClick={goOptimize}>
            进入优化对比 →
          </button>
        )}
      </header>

      <div className={analysisReady ? "jd-layout has-result" : "jd-layout"}>
        <section className="jd-input-card">
          <div className="input-card-head">
            <div>
              <span className="step-number">1</span>
              <div>
                <strong>选择匹配简历</strong>
                <small>可使用默认或历史版本</small>
              </div>
            </div>
            <span className="local-badge">本地规则处理</span>
          </div>
          <select
            value={currentId}
            onChange={(event) => setCurrentId(event.target.value)}
            aria-label="选择简历"
          >
            {resumes.map((resume) => (
              <option value={resume.id} key={resume.id}>
                {resume.name} · V{resume.version}
              </option>
            ))}
          </select>

          <div className="input-card-head second">
            <div>
              <span className="step-number">2</span>
              <div>
                <strong>粘贴岗位 JD</strong>
                <small>建议包含岗位职责与任职要求</small>
              </div>
            </div>
            <span className="local-badge">请粘贴文字</span>
          </div>
          <textarea
            className="jd-textarea"
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
          />
          <div className="textarea-meta">
            <span>{jdText.length} 字 · 内容完整</span>
            <button onClick={() => setJdText(jdSample)}>填入示例 JD</button>
          </div>
          <button className="analyze-button" onClick={analyzeJD} disabled={analyzing}>
            {analyzing ? (
              <>
                <span className="spinner" /> 正在识别岗位重点…
              </>
            ) : (
              "开始本地匹配"
            )}
          </button>
          <p className="analysis-safety">不连接任何 AI 服务，不上传简历或 JD；仅统计预设关键词的文字覆盖，本地规则不代表企业筛选结果。</p>
        </section>

        {!analysisReady && !analyzing && (
          <aside className="analysis-placeholder">
            <div className="placeholder-visual">
              <span>JD</span>
              <i />
              <b>简历</b>
            </div>
            <h2>分析结果将在这里展开</h2>
            <p>你将获得关键词覆盖、证据分层、优化建议和面试问题。</p>
            <div className="placeholder-list">
              {["岗位要求结构化解析", "简历证据逐项对应", "5–8 个面试准备问题"].map(
                (item) => (
                  <span key={item}>✓ {item}</span>
                ),
              )}
            </div>
          </aside>
        )}

        {analyzing && (
          <aside className="analysis-loading">
            <span className="big-spinner" />
            <h2>正在交叉比对简历与 JD</h2>
            <div className="loading-steps">
              <span className="done">✓ 提取岗位关键词</span>
              <span>比对简历证据…</span>
              <span>生成面试问题</span>
            </div>
          </aside>
        )}

        {analysisReady && (
          <section className="analysis-result">
            <div className="result-hero">
              <div className="score-ring">
                <strong>{result.matched.length}/{result.keywords.length}</strong>
                <span>关键词覆盖</span>
              </div>
              <div className="score-summary">
                <span className="good-badge">
                  {result.coverageLabel}
                </span>
                <h2>已比对 {result.keywords.length} 个岗位关键词</h2>
                <p>
                  {result.matched.length
                    ? `${result.matched.join("、")} 已在简历中体现。`
                    : "暂未在简历中找到明确匹配关键词。"}
                  {result.missing.length ? ` ${result.missing.join("、")} 尚未体现。` : ""}
                </p>
                <small>只表示预设词典的文字命中，不评估真实能力或录用概率。</small>
              </div>
              <div className="score-delta">
                <strong>{result.missing.length}</strong>
                <span>待确认缺失项</span>
              </div>
            </div>

            <div className="result-tabs">
              {[
                ["match", "匹配报告"],
                ["keywords", "JD 解析"],
                ["advice", "优化建议"],
                ["interview", "面试准备"],
              ].map(([key, label]) => (
                <button
                  className={analysisTab === key ? "active" : ""}
                  onClick={() => setAnalysisTab(key)}
                  key={key}
                >
                  {label}
                  {key === "advice" && <span>{suggestionCount}</span>}
                </button>
              ))}
            </div>

            {analysisTab === "match" && <MatchReport analysis={result} suggestionCount={suggestionCount} goOptimize={goOptimize} />}
            {analysisTab === "keywords" && <KeywordReport analysis={result} />}
            {analysisTab === "advice" && <AdviceReport suggestions={suggestions} goOptimize={goOptimize} />}
            {analysisTab === "interview" && <InterviewReport questions={result.questions} />}
          </section>
        )}
      </div>
    </div>
  );
}

function MatchReport({
  analysis,
  suggestionCount,
  goOptimize,
}: {
  analysis: JDAnalysisResult;
  suggestionCount: number;
  goOptimize: () => void;
}) {
  return (
    <div className="result-content">
      <div className="breakdown-grid">
        {[
          ["关键词覆盖", `${analysis.matched.length}/${analysis.keywords.length}`, "预设词典中已有文字命中的项目"],
          ["经历证据", String(analysis.evidence.filter((item) => item.level === "experience").length), "在教育、实习、项目或校园经历中命中"],
          ["陈述证据", String(analysis.evidence.filter((item) => item.level === "listed").length), "仅在技能、简介或其他陈述中命中"],
          ["待确认缺口", String(analysis.missing.length), "JD 出现、简历文字暂未体现；不等于不具备"],
        ].map(([label, value, note]) => (
          <div className="breakdown-card" key={String(label)}>
            <div><strong>{label}</strong><span>{value}</span></div>
            <p>{note}</p>
          </div>
        ))}
      </div>
      <div className="evidence-grid">
        <section className="evidence-card strength">
          <div className="evidence-head">
            <span>✓</span>
            <div><h3>简历优势</h3><p>{analysis.matched.length} 项要求已有文字证据</p></div>
          </div>
          {(analysis.matched.length ? analysis.matched : ["暂无明确匹配项"]).map((title) => (
            <div className="evidence-row" key={title}>
              <strong>{title}</strong>
              <p>{analysis.evidence.find((item) => item.keyword === title)?.sources.join("、") || "未找到来源"}</p>
              <em>{analysis.evidence.find((item) => item.keyword === title)?.level === "experience" ? "经历证据" : "陈述证据"}</em>
            </div>
          ))}
        </section>
        <section className="evidence-card gap">
          <div className="evidence-head">
            <span>!</span>
            <div><h3>暂未体现</h3><p>不是能力结论，只代表简历无证据</p></div>
          </div>
          {(analysis.missing.length ? analysis.missing : ["无"]).map((title) => (
            <div className="evidence-row" key={title}>
              <strong>{title}</strong><p>JD 中出现，但简历正文未检测到</p><em>待确认</em>
            </div>
          ))}
        </section>
      </div>
      <div className="result-cta">
        <div><strong>已生成 {suggestionCount} 条规则建议</strong><span>缺失技能不会自动写入简历</span></div>
        <button className="btn primary" onClick={goOptimize}>查看优化对比 →</button>
      </div>
    </div>
  );
}

function KeywordReport({ analysis }: { analysis: JDAnalysisResult }) {
  return (
    <div className="result-content keyword-content">
      <section>
        <h3>硬性要求</h3>
        <div className="keyword-cloud">
          {(analysis.keywords.length ? analysis.keywords : ["暂未识别到常见技术关键词"]).map(
            (keyword) => (
              <span className={analysis.matched.includes(keyword) ? "matched" : ""} key={keyword}>
                {analysis.matched.includes(keyword) ? "✓ " : ""}{keyword}
              </span>
            ),
          )}
        </div>
      </section>
      <section>
        <h3>软性能力</h3>
        <div className="keyword-cloud soft">
          {["沟通协作", "学习能力", "问题定位", "需求理解"].map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </section>
      <section className="invalid-copy">
        <span>低筛选价值描述</span>
        <p>“具备良好的沟通能力和学习能力”属于通用描述，需要用经历证据支撑。</p>
      </section>
    </div>
  );
}

function AdviceReport({
  suggestions,
  goOptimize,
}: {
  suggestions: Suggestion[];
  goOptimize: () => void;
}) {
  return (
    <div className="result-content">
      <div className="advice-list">
        {suggestions.map((suggestion, index) => (
          <div className="advice-row" key={suggestion.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{suggestion.kind}</strong><p>{suggestion.module} · {suggestion.reason}</p></div>
            <em>{suggestion.safe ? "安全建议" : "需要确认"}</em>
          </div>
        ))}
      </div>
      <button className="btn primary wide" onClick={goOptimize}>逐条查看修改前后</button>
    </div>
  );
}

function InterviewReport({
  questions,
}: {
  questions: [string, string, string][];
}) {
  return (
    <div className="result-content interview-list">
      {questions.map(([tag, question, source], index) => (
        <article key={question}>
          <span>{index + 1}</span>
          <div><em>{tag}</em><h3>{question}</h3><p>{source}</p></div>
          <button>准备要点 ＋</button>
        </article>
      ))}
    </div>
  );
}

function OptimizePage({
  suggestions,
  target,
  selected,
  setSelected,
  updateSuggestion,
  save,
  back,
}: {
  suggestions: Suggestion[];
  target: string;
  selected: number;
  setSelected: (id: number) => void;
  updateSuggestion: (id: number, status: Suggestion["status"]) => void;
  save: () => void;
  back: () => void;
}) {
  const item = suggestions.find((suggestion) => suggestion.id === selected) ?? suggestions[0];
  const accepted = suggestions.filter((suggestion) => suggestion.status === "accepted").length;
  const decided = suggestions.filter((suggestion) => suggestion.status !== "pending").length;
  return (
    <div className="optimize-page">
      <header className="optimize-topbar">
        <div>
          <button onClick={back}>← 返回分析</button>
          <div>
            <p className="eyebrow">规则优化对比</p>
            <h1>{target} · JD 定向优化</h1>
          </div>
        </div>
        <div className="decision-progress">
          <span>{decided} / {suggestions.length} 已处理</span>
          <i><b style={{ width: `${(decided / suggestions.length) * 100}%` }} /></i>
        </div>
        <button className="btn primary" onClick={save}>保存为新版本</button>
      </header>

      <div className="optimize-workspace">
        <aside className="suggestion-list">
          <div className="suggestion-list-head">
            <div><strong>修改建议</strong><span>{suggestions.length}</span></div>
            <small>逐条确认后再保存</small>
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              className={selected === suggestion.id ? "suggestion-nav active" : "suggestion-nav"}
              onClick={() => setSelected(suggestion.id)}
            >
              <span className={`status-dot ${suggestion.status}`}>{suggestion.status === "accepted" ? "✓" : suggestion.status === "rejected" ? "×" : index + 1}</span>
              <div><strong>{suggestion.kind}</strong><small>{suggestion.module} · {suggestion.keyword}</small></div>
              <em>{suggestion.safe ? "安全" : "需补充"}</em>
            </button>
          ))}
          <div className="fact-guard">
            <span>事实保护已开启</span>
            <p>新增数字、技能或成果时，必须先由你补充真实信息。</p>
          </div>
        </aside>

        <section className="comparison-area">
          <div className="comparison-heading">
            <div>
              <span className={item.safe ? "safe-badge" : "warning-badge"}>
                {item.safe ? "✓ 事实安全" : "! 需要真实信息"}
              </span>
              <h2>{item.kind}</h2>
              <p>{item.reason}</p>
            </div>
            <span className="keyword-reference">对应 JD：{item.keyword}</span>
          </div>

          <div className="comparison-grid">
            <article className="compare-card original">
              <header><span>修改前</span><em>原始简历</em></header>
              <div className="compare-module-label">{item.module}</div>
              <p>{item.original}</p>
            </article>
            <article className="compare-card optimized">
              <header><span>修改后</span><em>规则建议预览</em></header>
              <div className="compare-module-label">{item.module}</div>
              <p>{item.optimized}</p>
              {!item.safe && (
                <div className="unsafe-note">【】中的内容必须由你填写，当前版本不会写入简历。</div>
              )}
            </article>
          </div>

          <div className="change-explanation">
            <span>修改说明</span>
            <p>{item.reason}</p>
            <div>
              <em>未修改时间</em><em>未添加技能</em><em>未虚构成果</em>
            </div>
          </div>

          <div className="decision-actions">
            <button
              className={item.status === "rejected" ? "reject active" : "reject"}
              onClick={() => updateSuggestion(item.id, "rejected")}
            >
              × 保留原文
            </button>
            <span>你的选择可以随时更改</span>
            <button
              className={item.status === "accepted" ? "accept active" : "accept"}
              onClick={() => updateSuggestion(item.id, "accepted")}
              disabled={!item.safe}
            >
              ✓ {item.safe ? "接受修改" : "补充后可接受"}
            </button>
          </div>
        </section>

        <aside className="optimization-summary">
          <span className="panel-kicker">版本摘要</span>
          <h3>当前决策</h3>
          <div className="decision-stat">
            <div><strong>{accepted}</strong><span>已接受</span></div>
            <div><strong>{suggestions.filter((s) => s.status === "rejected").length}</strong><span>已拒绝</span></div>
          </div>
          <div className="summary-divider" />
          <h4>将产生的变化</h4>
          <ul>
            <li>相关经历排序更清晰</li>
            <li>Java / OOP 关键词更突出</li>
            <li>原始版本完整保留</li>
          </ul>
          <button className="btn dark wide" onClick={save}>完成并保存版本</button>
          <p>保存后可继续手动微调</p>
        </aside>
      </div>
    </div>
  );
}

function MonthRangePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const initial = parseResumePeriod(value);
  const [startMonth, setStartMonth] = useState(initial.parsed ? initial.startMonth : "");
  const [endMonth, setEndMonth] = useState(initial.parsed ? initial.endMonth : "");
  const [present, setPresent] = useState(initial.parsed ? initial.present : false);
  const [editing, setEditing] = useState(initial.parsed);
  const [error, setError] = useState("");
  const [syncedValue, setSyncedValue] = useState(value);
  const errorId = useId();
  if (syncedValue !== value) {
    setSyncedValue(value);
    const parsed = parseResumePeriod(value);
    if (!parsed.parsed) {
      setEditing(false);
      setError("");
    } else {
      setStartMonth(parsed.startMonth);
      setEndMonth(parsed.endMonth);
      setPresent(parsed.present);
      setEditing(true);
      setError("");
    }
  }

  const commit = (nextStart: string, nextEnd: string, nextPresent: boolean) => {
    const nextError = validateMonthRange(nextStart, nextEnd, nextPresent);
    setError(nextError);
    if (!nextError) onChange(formatResumePeriod(nextStart, nextEnd, nextPresent));
  };

  if (!editing) {
    return (
      <div className="field month-range-field">
        <span>{label}</span>
        <div className="period-preserved">
          <span>保留的导入时间：{value}</span>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setStartMonth("");
              setEndMonth("");
              setPresent(false);
              setError("");
            }}
          >
            重新选择
          </button>
        </div>
      </div>
    );
  }

  return (
    <fieldset className="field month-range-field" aria-describedby={error ? errorId : undefined}>
      <legend>{label}</legend>
      <div className="month-range-inputs">
        <label>
          <span>开始月份</span>
          <input
            type="month"
            value={startMonth}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onInput={(event) => {
              const next = event.target.value;
              setStartMonth(next);
              const fieldset = event.currentTarget.closest("fieldset");
              const end = fieldset?.querySelectorAll<HTMLInputElement>('input[type="month"]')[1]?.value ?? endMonth;
              const isPresent = fieldset?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked ?? present;
              commit(next, end, isPresent);
            }}
          />
        </label>
        <label>
          <span>结束月份</span>
          <input
            type="month"
            value={endMonth}
            disabled={present}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onInput={(event) => {
              const next = event.target.value;
              setEndMonth(next);
              const fieldset = event.currentTarget.closest("fieldset");
              const start = fieldset?.querySelector<HTMLInputElement>('input[type="month"]')?.value ?? startMonth;
              const isPresent = fieldset?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked ?? present;
              commit(start, next, isPresent);
            }}
          />
        </label>
      </div>
      <label className="period-present">
        <input
          type="checkbox"
          checked={present}
          onChange={(event) => {
            const next = event.target.checked;
            setPresent(next);
            const fieldset = event.currentTarget.closest("fieldset");
            const months = fieldset?.querySelectorAll<HTMLInputElement>('input[type="month"]');
            commit(months?.[0]?.value ?? startMonth, months?.[1]?.value ?? endMonth, next);
          }}
        />
        至今
      </label>
      {error && <small className="field-error" id={errorId}>{error}</small>}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toggleBold = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = `**${selected}**`;
    onChange(value.slice(0, start) + replacement + value.slice(end));
    window.requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + 2;
      textarea.setSelectionRange(
        selectionStart,
        selectionStart + selected.length,
      );
    });
  };
  return (
    <label className="field">
      <span className="field-heading">
        <span>{label}</span>
        <button
          type="button"
          className="format-bold-button"
          onClick={(event) => {
            event.preventDefault();
            toggleBold();
          }}
          title="加粗选中的文字"
          aria-label={`加粗${label}中选中的文字`}
        >
          B
        </button>
      </span>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
            event.preventDefault();
            toggleBold();
          }
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SmartHint({ project = false }: { project?: boolean }) {
  return (
    <div className="smart-hint">
      <span className="hint-icon">提示</span>
      <div>
        <strong>{project ? "这段项目经历还可以更具体" : "建议补充可验证的信息"}</strong>
        <p>
          {project
            ? "你解决了什么具体问题？哪些部分由你独立完成？"
            : "使用了什么工具？数据规模多大？最终产生了什么结果？"}
        </p>
      </div>
      <button>查看写法</button>
    </div>
  );
}

function TruthNotice() {
  return (
    <div className="truth-notice">
      <span>盾</span>
      <p><strong>真实信息保护</strong>写作提示只基于你已填写的内容，不会添加不存在的经历、技能或数据。</p>
    </div>
  );
}

function Modal({
  title,
  className = "",
  onClose,
  children,
}: {
  title: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
        {children}
      </section>
    </div>
  );
}
