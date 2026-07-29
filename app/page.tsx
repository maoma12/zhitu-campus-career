"use client";

import {
  ChangeEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AuthSession,
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
} from "./lib/resume-import";

type View = "dashboard" | "editor" | "jd" | "optimize";
type Template = "classic" | "azure" | "sidebar";
type StandardModuleKey =
  | "basic"
  | "experience"
  | "education"
  | "project"
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

type Resume = {
  id: string;
  name: string;
  target: string;
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

type JDAnalysisResult = {
  score: number;
  keywords: string[];
  matched: string[];
  missing: string[];
  questions: [string, string, string][];
};

const moduleMeta: Record<StandardModuleKey, { label: string; icon: string }> = {
  basic: { label: "基本信息", icon: "人" },
  experience: { label: "实习经历", icon: "历" },
  education: { label: "教育经历", icon: "学" },
  project: { label: "项目经历", icon: "项" },
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

const secondResume: Resume = {
  ...seedResume,
  id: "resume-product",
  name: "产品经理实习简历",
  target: "产品经理实习生",
  updated: "昨天 18:42",
  completion: 82,
  version: 2,
  basic: { ...seedResume.basic, target: "产品经理实习生" },
  experiences: seedResume.experiences.map((item) => ({ ...item, id: "experience-product" })),
  educations: seedResume.educations.map((item) => ({ ...item, id: "education-product" })),
  projects: seedResume.projects.map((item) => ({ ...item, id: "project-product" })),
};

const blankResume: Resume = {
  id: "resume-blank",
  name: "我的第一份简历",
  target: "",
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
  const jdLower = jd.toLowerCase();
  const resumeText = JSON.stringify(resume).toLowerCase();
  const selected = jdKeywordRules.filter((rule) =>
    rule.aliases.some((alias) => jdLower.includes(alias.toLowerCase())),
  );
  const matchedRules = selected.filter((rule) =>
    rule.aliases.some((alias) => resumeText.includes(alias.toLowerCase())),
  );
  const missingRules = selected.filter((rule) => !matchedRules.includes(rule));
  const score = selected.length
    ? Math.round((matchedRules.length / selected.length) * 100)
    : 0;
  const questions: [string, string, string][] = selected.slice(0, 7).map((rule) => [
    missingRules.includes(rule) ? "待补充能力" : "岗位重点",
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
    score,
    keywords: selected.map((rule) => rule.label),
    matched: matchedRules.map((rule) => rule.label),
    missing: missingRules.map((rule) => rule.label),
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
      .map((key) => [key, safeString(rawLabels[key]).trim()] as co…29245 tokens truncated…
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
    score: 0,
    keywords: [],
    matched: [],
    missing: [],
    questions: [],
  };
  return (
    <div className="page jd-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">JD 本地规则匹配</p>
          <h1>看懂岗位，再调整简历</h1>
          <p>系统只引用简历中已有内容，未体现的能力会明确标记。</p>
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
          <p className="analysis-safety">不连接任何 AI 服务，不上传简历或 JD；建议仅基于已有文字和预设规则。</p>
        </section>

        {!analysisReady && !analyzing && (
          <aside className="analysis-placeholder">
            <div className="placeholder-visual">
              <span>JD</span>
              <i />
              <b>简历</b>
            </div>
            <h2>分析结果将在这里展开</h2>
            <p>你将获得岗位关键词、四维匹配评分、优化建议和面试问题。</p>
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
                <strong>{result.score}</strong>
                <span>匹配分</span>
              </div>
              <div className="score-summary">
                <span className="good-badge">
                  {result.score >= 75 ? "匹配度较高" : result.score >= 50 ? "具备部分基础" : "需要重点补充"}
                </span>
                <h2>已比对 {result.keywords.length} 个岗位关键词</h2>
                <p>
                  {result.matched.length
                    ? `${result.matched.join("、")} 已在简历中体现。`
                    : "暂未在简历中找到明确匹配关键词。"}
                  {result.missing.length ? ` ${result.missing.join("、")} 尚未体现。` : ""}
                </p>
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
          ["关键词覆盖", analysis.score, `${analysis.matched.length}/${analysis.keywords.length} 个关键词已有体现`],
          ["岗位缺失项", Math.max(0, 100 - analysis.score), `${analysis.missing.length} 项要求尚未在简历中体现`],
          ["成果表达", 60, "请人工检查是否包含可验证的动作与结果"],
          ["事实安全", 100, "规则分析不会向简历添加不存在的信息"],
        ].map(([label, score, note]) => (
          <div className="breakdown-card" key={String(label)}>
            <div><strong>{label}</strong><span>{score}</span></div>
            <i><b style={{ width: `${score}%` }} /></i>
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
              <strong>{title}</strong><p>简历正文中检测到对应关键词</p><em>已匹配</em>
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
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
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
