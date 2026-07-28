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
  basic: { label: "åŸºæœ¬ä¿¡æ¯", icon: "äºº" },
  experience: { label: "å®ä¹ ç»å†", icon: "å†" },
  education: { label: "æ•™è‚²ç»å†", icon: "å­¦" },
  project: { label: "é¡¹ç›®ç»å†", icon: "é¡¹" },
  skills: { label: "æŠ€èƒ½ç‰¹é•¿", icon: "æŠ€" },
  certificate: { label: "è¯ä¹¦è£èª‰", icon: "è¯" },
  evaluation: { label: "è‡ªæˆ‘è¯„ä»·", icon: "è¯„" },
  portfolio: { label: "ä½œå“å±•ç¤º", icon: "é“¾" },
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
    "è‡ªå®šä¹‰æ¨¡å—"
  );
}

function moduleIcon(key: ModuleKey) {
  return isStandardModuleKey(key) ? moduleMeta[key].icon : "è‡ª";
}

const seedResume: Resume = {
  id: "resume-main",
  name: "Java åç«¯å¼€å‘æ ¡æ‹›ç®€å†",
  target: "Java åç«¯å¼€å‘å®ä¹ ç”Ÿ",
  updated: "åˆšåˆš",
  completion: 88,
  version: 3,
  basic: {
    name: "é™ˆé”šç‚€",
    phone: "150 1729 4882",
    email: "2687922667@qq.com",
    city: "æ·±åœ³",
    target: "Java åç«¯å¼€å‘å®ä¹ ç”Ÿ",
    summary:
      "é€šä¿¡å·¥ç¨‹ä¸“ä¸šæœ¬ç§‘ç”Ÿï¼Œå…·å¤‡ Javaã€SQL ä¸æ•°æ®ç»“æ„åŸºç¡€ï¼Œæœ‰äº§å“éœ€æ±‚åˆ†æå’Œè½¯ç¡¬ä»¶ååŒé¡¹ç›®ç»éªŒã€‚",
    avatar: "",
  },
  experiences: [{
    id: "experience-seed",
    company: "é¡ºä¸°é€Ÿè¿é›†å›¢",
    role: "åŠ©ç†äº§å“ç»ç† Â· äº§ä¸šå›­ä¿¡æ¯åŒ–ç»„",
    period: "2026.01 â€” 2026.04",
    description:
      "è´Ÿè´£å›­åŒºäººå‘˜è½¨è¿¹æ•°æ®æ•´ç†ä¸æ—¥æŠ¥è¾“å‡ºï¼ŒåŸºäºç”¨æˆ·åé¦ˆæ¢³ç†å®šä½ã€æ’ç­ä¸å‘Šè­¦éœ€æ±‚ï¼›ååŒç ”å‘å›¢é˜Ÿæ¨è¿›éœ€æ±‚è¯„å®¡ã€ç‰ˆæœ¬è¿­ä»£ä¸ä¸Šçº¿éªŒæ”¶ã€‚",
  }],
  educations: [{
    id: "education-seed",
    school: "æ·±åœ³å¤§å­¦",
    major: "é€šä¿¡å·¥ç¨‹ Â· ç”µå­ä¸ä¿¡æ¯å·¥ç¨‹å­¦é™¢",
    degree: "æœ¬ç§‘ Â· å…¨æ—¥åˆ¶",
    period: "2023.09 â€” 2027.06",
    detail:
      "GPA 3.45/4.5ï¼Œä¸“ä¸šå‰ 30%ï¼›æ ¸å¿ƒè¯¾ç¨‹ï¼šæ•°æ®ç»“æ„ï¼ˆ92ï¼‰ã€é¢å‘å¯¹è±¡ç¨‹åºè®¾è®¡ï¼ˆ88ï¼‰ã€è®¡ç®—æœºç½‘ç»œã€‚",
  }],
  projects: [{
    id: "project-seed",
    name: "æ— äººæœºç‰©æµè°ƒåº¦ç®¡ç†ç³»ç»Ÿ",
    role: "æ ¸å¿ƒå¼€å‘",
    period: "2025.11 â€” 2026.12",
    stack: "C++ Â· OOP Â· Cursor",
    description:
      "å®Œæˆå¤šæ–‡ä»¶ C++ é¡¹ç›®ç»“æ„è®¾è®¡ï¼ŒåŸºäºç»§æ‰¿ä¸æ´¾ç”Ÿç±»å®ç°ä»»åŠ¡åˆ†å‘ã€è®¢å•åˆ†é…å’Œæœ¬åœ°æ•°æ®æŒä¹…åŒ–ï¼›ç‹¬ç«‹è®¾è®¡æ§åˆ¶å°äº¤äº’æµç¨‹ã€‚",
  }],
  skills:
    "Java Â· C/C++ Â· SQL Â· æ•°æ®ç»“æ„ Â· Git Â· å¢¨åˆ€ Â· Excel Â· è‹±è¯­å…­çº§",
  certificate: "å…¨å›½å¤§å­¦ç”Ÿç”µå­è®¾è®¡ç«èµ›æ ¡çº§ä¸€ç­‰å¥– Â· å¤§å­¦è‹±è¯­å…­çº§",
  evaluation:
    "é€»è¾‘æ¸…æ™°ï¼Œèƒ½å¤Ÿä»ç”¨æˆ·é—®é¢˜ä¸­æ‹†è§£éœ€æ±‚å¹¶ååŒæ¨è¿›è½åœ°ï¼›ä¿æŒå¯¹æŠ€æœ¯å®ç°çš„å¥½å¥‡å¿ƒå’ŒæŒç»­å­¦ä¹ ä¹ æƒ¯ã€‚",
  portfolio: "GitHub Â· github.com/chen-maoyang  ï½œ  ä½œå“é›† Â· portfolio.example.com",
  moduleLabels: {},
  customModules: [],
  moduleOrder: defaultOrder,
  hiddenModules: [],
};

const secondResume: Resume = {
  ...seedResume,
  id: "resume-product",
  name: "äº§å“ç»ç†å®ä¹ ç®€å†",
  target: "äº§å“ç»ç†å®ä¹ ç”Ÿ",
  updated: "æ˜¨å¤© 18:42",
  completion: 82,
  version: 2,
  basic: { ...seedResume.basic, target: "äº§å“ç»ç†å®ä¹ ç”Ÿ" },
  experiences: seedResume.experiences.map((item) => ({ ...item, id: "experience-product" })),
  educations: seedResume.educations.map((item) => ({ ...item, id: "education-product" })),
  projects: seedResume.projects.map((item) => ({ ...item, id: "project-product" })),
};

const blankResume: Resume = {
  id: "resume-blank",
  name: "æˆ‘çš„ç¬¬ä¸€ä»½ç®€å†",
  target: "",
  updated: "åˆšåˆš",
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
    module: "å®ä¹ ç»å†",
    kind: "æˆæœå‰ç½®",
    keyword: "æ•°æ®åˆ†æ",
    original:
      "è´Ÿè´£å›­åŒºäººå‘˜è½¨è¿¹æ•°æ®æ•´ç†ä¸æ—¥æŠ¥è¾“å‡ºï¼ŒåŸºäºç”¨æˆ·åé¦ˆæ¢³ç†å®šä½ã€æ’ç­ä¸å‘Šè­¦éœ€æ±‚ã€‚",
    optimized:
      "å›´ç»•å›­åŒºäººå‘˜è½¨è¿¹åœºæ™¯ï¼Œæ•´ç†ä¸šåŠ¡æ•°æ®å¹¶è¾“å‡ºæ—¥æŠ¥ï¼›ç»“åˆç”¨æˆ·åé¦ˆæ¢³ç†å®šä½ã€æ’ç­ä¸å‘Šè­¦éœ€æ±‚ï¼Œä¸ºéœ€æ±‚è¯„å®¡æä¾›ä¾æ®ã€‚",
    reason: "ä¿ç•™åŸæœ‰äº‹å®ï¼Œå°†ä¸šåŠ¡åœºæ™¯ã€åŠ¨ä½œå’Œäº§å‡ºæŒ‰é˜…è¯»é¡ºåºé‡ç»„ã€‚",
    status: "pending",
    safe: true,
  },
  {
    id: 2,
    module: "é¡¹ç›®ç»å†",
    kind: "å…³é”®è¯å¼ºåŒ–",
    keyword: "é¢å‘å¯¹è±¡",
    original:
      "åŸºäºç»§æ‰¿ä¸æ´¾ç”Ÿç±»å®ç°ä»»åŠ¡åˆ†å‘ã€è®¢å•åˆ†é…å’Œæœ¬åœ°æ•°æ®æŒä¹…åŒ–ã€‚",
    optimized:
      "è¿ç”¨é¢å‘å¯¹è±¡è®¾è®¡æ–¹æ³•ï¼Œä»¥ç»§æ‰¿ä¸æ´¾ç”Ÿç±»å®Œæˆä»»åŠ¡åˆ†å‘ã€è®¢å•åˆ†é…åŠæœ¬åœ°æ•°æ®æŒä¹…åŒ–ã€‚",
    reason: "å¼ºåŒ–ç®€å†ä¸­å·²ç»å­˜åœ¨ã€ä¸”ä¸ JD ç›¸å…³çš„é¢å‘å¯¹è±¡èƒ½åŠ›ã€‚",
    status: "pending",
    safe: true,
  },
  {
    id: 3,
    module: "æŠ€èƒ½ç‰¹é•¿",
    kind: "ç»“æ„è°ƒæ•´",
    keyword: "Java / SQL",
    original: "Java Â· C/C++ Â· SQL Â· æ•°æ®ç»“æ„ Â· Git Â· å¢¨åˆ€ Â· Excel",
    optimized: "å¼€å‘åŸºç¡€ï¼šJava Â· SQL Â· æ•°æ®ç»“æ„ Â· Git\nå…¶ä»–å·¥å…·ï¼šC/C++ Â· å¢¨åˆ€ Â· Excel",
    reason: "å°†ç›®æ ‡å²—ä½ç›¸å…³æŠ€èƒ½ä¼˜å…ˆå±•ç¤ºï¼Œä¸æ–°å¢æŠ€èƒ½ã€‚",
    status: "pending",
    safe: true,
  },
  {
    id: 4,
    module: "å®ä¹ ç»å†",
    kind: "ä¿¡æ¯è¡¥å……",
    keyword: "é‡åŒ–ç»“æœ",
    original: "ååŒç ”å‘å›¢é˜Ÿæ¨è¿›éœ€æ±‚è¯„å®¡ã€ç‰ˆæœ¬è¿­ä»£ä¸ä¸Šçº¿éªŒæ”¶ã€‚",
    optimized:
      "ååŒã€å›¢é˜Ÿè§’è‰²ã€‘æ¨è¿›ã€ç‰ˆæœ¬æ•°é‡ã€‘æ¬¡éœ€æ±‚è¯„å®¡ã€ç‰ˆæœ¬è¿­ä»£ä¸ä¸Šçº¿éªŒæ”¶ï¼Œæœ€ç»ˆå®ç°ã€çœŸå®ç»“æœã€‘ã€‚",
    reason: "åŸæ–‡ç¼ºå°‘å¯éªŒè¯çš„è§„æ¨¡å’Œç»“æœï¼Œéœ€è¦ä½ è¡¥å……çœŸå®ä¿¡æ¯åæ‰èƒ½ä½¿ç”¨ã€‚",
    status: "pending",
    safe: false,
  },
];

const jdSample = `Java åç«¯å¼€å‘å®ä¹ ç”Ÿ

å²—ä½èŒè´£ï¼š
1. å‚ä¸ä¸šåŠ¡ç³»ç»Ÿåç«¯åŠŸèƒ½å¼€å‘ã€æ¥å£è®¾è®¡ä¸å•å…ƒæµ‹è¯•ï¼›
2. é…åˆäº§å“ä¸æµ‹è¯•å®Œæˆéœ€æ±‚åˆ†æã€é—®é¢˜å®šä½å’Œç‰ˆæœ¬è¿­ä»£ï¼›
3. å‚ä¸æ•°æ®åº“è¡¨è®¾è®¡åŠæ€§èƒ½ä¼˜åŒ–ã€‚

ä»»èŒè¦æ±‚ï¼š
1. è®¡ç®—æœºç›¸å…³ä¸“ä¸šæœ¬ç§‘åŠä»¥ä¸Šå­¦å†ï¼›
2. ç†Ÿæ‚‰ Java åŸºç¡€ã€é¢å‘å¯¹è±¡ç¼–ç¨‹ä¸å¸¸ç”¨é›†åˆï¼›
3. äº†è§£ Spring Bootã€MySQLã€Gitï¼›
4. æŒæ¡æ•°æ®ç»“æ„ã€TCP/IP ç­‰è®¡ç®—æœºåŸºç¡€ï¼›
5. å…·å¤‡è‰¯å¥½çš„æ²Ÿé€šèƒ½åŠ›å’Œå­¦ä¹ èƒ½åŠ›ã€‚`;

const jdKeywordRules = [
  { label: "Java", aliases: ["java"], question: "è¯·è¯´æ˜ Java é¢å‘å¯¹è±¡çš„æ ¸å¿ƒç‰¹æ€§ï¼Œå¹¶ç»“åˆé¡¹ç›®ä¸¾ä¾‹ã€‚" },
  { label: "Spring Boot", aliases: ["spring boot", "springboot"], question: "è¯·ä»‹ç» Spring Boot è‡ªåŠ¨é…ç½®çš„åŸºæœ¬åŸç†ã€‚" },
  { label: "MySQL", aliases: ["mysql"], question: "è¯·è¯´æ˜å¸¸ç”¨ç´¢å¼•ç±»å‹ä»¥åŠç´¢å¼•å¤±æ•ˆçš„åœºæ™¯ã€‚" },
  { label: "SQL", aliases: ["sql", "æ•°æ®åº“"], question: "å¦‚æœæ•°æ®é‡å¢é•¿ï¼Œä½ ä¼šå¦‚ä½•åˆ†æå’Œä¼˜åŒ–ä¸€æ¡æ…¢æŸ¥è¯¢ï¼Ÿ" },
  { label: "Git", aliases: ["git"], question: "å›¢é˜Ÿåä½œä¸­ä½ å¦‚ä½•å¤„ç† Git åˆ†æ”¯å†²çªï¼Ÿ" },
  { label: "æ•°æ®ç»“æ„", aliases: ["æ•°æ®ç»“æ„", "data structure"], question: "è¯·æ¯”è¾ƒæ•°ç»„ã€é“¾è¡¨å’Œå“ˆå¸Œè¡¨çš„é€‚ç”¨åœºæ™¯ã€‚" },
  { label: "TCP/IP", aliases: ["tcp/ip", "tcp", "è®¡ç®—æœºç½‘ç»œ"], question: "è¯·è¯´æ˜ TCP ä¸‰æ¬¡æ¡æ‰‹å’Œå››æ¬¡æŒ¥æ‰‹çš„è¿‡ç¨‹ã€‚" },
  { label: "Linux", aliases: ["linux"], question: "ä½ å¸¸ç”¨å“ªäº› Linux å‘½ä»¤æ’æŸ¥è¿›ç¨‹æˆ–ç½‘ç»œé—®é¢˜ï¼Ÿ" },
  { label: "Redis", aliases: ["redis"], question: "è¯·è¯´æ˜ Redis å¸¸è§æ•°æ®ç»“æ„åŠå…¶é€‚ç”¨åœºæ™¯ã€‚" },
  { label: "Python", aliases: ["python"], question: "è¯·ä»‹ç»ä½ ç”¨ Python å®Œæˆè¿‡çš„ä¸€ä¸ªå…·ä½“ä»»åŠ¡ã€‚" },
  { label: "C/C++", aliases: ["c++", "c/c++"], question: "è¯·è¯´æ˜ C++ ä¸­ç»§æ‰¿ä¸å¤šæ€çš„å®ç°æ–¹å¼ã€‚" },
  { label: "React", aliases: ["react"], question: "è¯·è¯´æ˜ React çŠ¶æ€æ›´æ–°ä¸ç»„ä»¶æ¸²æŸ“ä¹‹é—´çš„å…³ç³»ã€‚" },
  { label: "Vue", aliases: ["vue"], question: "è¯·ä»‹ç» Vue å“åº”å¼ç³»ç»Ÿçš„åŸºæœ¬æ€è·¯ã€‚" },
  { label: "æ²Ÿé€šåä½œ", aliases: ["æ²Ÿé€š", "åä½œ", "å›¢é˜Ÿåˆä½œ"], question: "è¯·ä¸¾ä¾‹è¯´æ˜ä½ å¦‚ä½•åè°ƒä¸åŒè§’è‰²æ¨è¿›ä¸€é¡¹ä»»åŠ¡ã€‚" },
  { label: "å­¦ä¹ èƒ½åŠ›", aliases: ["å­¦ä¹ èƒ½åŠ›", "å¿«é€Ÿå­¦ä¹ "], question: "è¯·ä¸¾ä¾‹è¯´æ˜ä½ å¦‚ä½•åœ¨çŸ­æ—¶é—´å†…æŒæ¡ä¸€é¡¹æ–°æŠ€èƒ½ã€‚" },
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
    missingRules.includes(rule) ? "å¾…è¡¥å……èƒ½åŠ›" : "å²—ä½é‡ç‚¹",
    rule.question,
    `æ¥æºï¼šJD å…³é”®è¯ã€Œ${rule.label}ã€`,
  ]);
  if (questions.length < 5) {
    questions.push(
      ["é¡¹ç›®æ·±æŒ–", "è¯·é€‰æ‹©ä¸€ä¸ªæœ€èƒ½ä»£è¡¨ä½ çš„é¡¹ç›®ï¼Œè¯´æ˜èƒŒæ™¯ã€ä¸ªäººä»»åŠ¡ã€è¡ŒåŠ¨å’Œç»“æœã€‚", "æ¥æºï¼šç®€å†é¡¹ç›®ç»å†"],
      ["è¡Œä¸ºé¢è¯•", "è¯·ä¸¾ä¾‹è¯´æ˜ä½ é‡åˆ°å›°éš¾åå¦‚ä½•å®šä½é—®é¢˜å¹¶æ¨åŠ¨è§£å†³ã€‚", "æ¥æºï¼šé€šç”¨æ ¡æ‹›é¢è¯•"],
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
    .split(/[Â·,ï¼Œã€|ï½œ\n]/)
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
    .join(" Â· ");
  const experience = resume.experiences[0];
  const project = resume.projects[0];
  const suggestions: Suggestion[] = [];

  if (resume.skills && orderedSkills !== resume.skills) {
    suggestions.push({
      id: suggestions.length + 1,
      module: "æŠ€èƒ½ç‰¹é•¿",
      kind: "å²—ä½ç›¸å…³é¡¹å‰ç½®",
      keyword: analysis.matched.slice(0, 3).join(" / ") || "æŠ€èƒ½æ’åº",
      original: resume.skills,
      optimized: orderedSkills,
      reason: "ä»…è°ƒæ•´å·²æœ‰æŠ€èƒ½çš„å±•ç¤ºé¡ºåºï¼Œä¸æ·»åŠ æ–°æŠ€èƒ½ã€‚",
      status: "pending",
      safe: true,
      applyTo: "skills",
    });
  }

  if (resume.basic.summary && resume.basic.target) {
    const optimized = `${resume.basic.target}æ–¹å‘ï¼›${resume.basic.summary}`
      .replace(/[ï¼›;]{2,}/g, "ï¼›")
      .trim();
    if (optimized !== resume.basic.summary) {
      suggestions.push({
        id: suggestions.length + 1,
        module: "ä¸ªäººç®€ä»‹",
        kind: "æ±‚èŒæ–¹å‘å‰ç½®",
        keyword: resume.basic.target,
        original: resume.basic.summary,
        optimized,
        reason: "å°†ç®€å†ä¸­å·²ç»å¡«å†™çš„æ±‚èŒç›®æ ‡å‰ç½®ï¼Œä¿ç•™åŸç®€ä»‹äº‹å®ã€‚",
        status: "pending",
        safe: true,
        applyTo: "summary",
      });
    }
  }

  if (experience?.description) {
    const optimized = experience.description
      .split(/[ï¼›;]/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join("ï¼›");
    suggestions.push({
      id: suggestions.length + 1,
      module: "å®ä¹ ç»å†",
      kind: "é•¿å¥æ‹†åˆ†",
      keyword: analysis.matched[0] ?? "ç»å†è¡¨è¾¾",
      original: experience.description,
      optimized,
      reason: "ä»…æ•´ç†åŸæœ‰å¥å­å’Œæ ‡ç‚¹ï¼Œä¸ä¿®æ”¹æ—¶é—´ã€èŒè´£æˆ–ç»“æœã€‚",
      status: "pending",
      safe: true,
      applyTo: "experience",
      targetId: experißß7êÚ$z{-®éÜj×’À¢—Ğ¢ÂöF—cà¢Âö6–FSà¢—Ğ ¢¶æÇ—¦–ærbb€¢Æ6–FR6Æ74æÖSÒ&æÇ—6—2ÖÆöF–ær#à¢Ç7â6Æ74æÖSÒ&&–r×7–ææW""óà¢Æƒ#îjÚ>YÊKªNXøjùNZûzèXènKˆâ¤CÂöƒ#à¢ÆF—b6Æ74æÖSÒ&ÆöF–ær×7FW2#à¢Ç7â6Æ74æÖSÒ&FöæR#î)É2hùXùn[)~KØŞX[>™JîŠøÓÂ÷7ãà¢Ç7ãîjùNZûzèXènŠøhÚî(
cÂ÷7ãà¢Ç7ãîyIşh‰™Ú.Šù^™zîš)ƒÂ÷7ãà¢ÂöF—cà¢Âö6–FSà¢—Ğ ¢¶æÇ—6—5&VG’bb€¢Ç6V7F–öâ6Æ74æÖSÒ&æÇ—6—2×&W7VÇB#à¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ†W&ò#à¢ÆF—b6Æ74æÖSÒ'66÷&R×&–ær#à¢Ç7G&öæsç·&W7VÇBç66÷&WÓÂ÷7G&öæsà¢Ç7ãîXË˜XŞXˆcÂ÷7ãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'66÷&R×7VÖÖ'’#à¢Ç7â6Æ74æÖSÒ&vööBÖ&FvR#à¢·&W7VÇBç66÷&RãÒsRò.XË˜XŞ[ªn‹è>š¹‚"¢&W7VÇBç66÷&RãÒSò.X[~ZH~˜:XˆnYû®z"¢.™ÈŠh˜xŞx+Š^XXR'Ğ¢Â÷7ãà¢Æƒ#î[{.jùNZû’·&W7VÇBæ¶W—v÷&G2æÆVæwF‡ÒKŠ®[)~KØŞX[>™JîŠøÓÂöƒ#à¢Çà¢·&W7VÇBæÖF6†VBæÆVæwF€¢òG·&W7VÇBæÖF6†VBæ¦ö–â‚.8"—Ò[{.YÊzèXènKŠŞKÙ>xë8& ¢¢.i¨.iÊ®YÊzèXènKŠŞh›îX‹iˆîzîXË˜XŞX[>™JîŠøŞ8"'Ğ¢·&W7VÇBæÖ—76–æræÆVæwF‚òG·&W7VÇBæÖ—76–æræ¦ö–â‚.8"—Ò[	®iÊ®KÙ>xë8&¢"'Ğ¢Â÷à¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'66÷&RÖFVÇF#à¢Ç7G&öæsç·&W7VÇBæÖ—76–æræÆVæwF‡ÓÂ÷7G&öæsà¢Ç7ãî[è^zîŠêN{Ë®ZKš“Â÷7ãà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ'&W7VÇB×F'2#à¢µ°¢²&ÖF6‚"Â.XË˜XŞhª^Y¢%ÒÀ¢²&¶W—v÷&G2"Â$¤BŠz>ié%ÒÀ¢²&Gf–6R"Â.KÉXÉn[»®Šêâ%ÒÀ¢²&–çFW'f–Wr"Â.™Ú.Šù^XxnZHr%ÒÀ¢ÒæÖ‚…¶¶W’ÂÆ&VÅÒ’Óâ€¢Æ'WGFöà¢6Æ74æÖS×¶æÇ—6—5F"ÓÓÒ¶W’ò&7F—fR"¢"'Ğ¢öä6Æ–6³×²‚’Óâ6WDæÇ—6—5F"†¶W’—Ğ¢¶W“×¶¶W—Ğ¢à¢¶Æ&VÇĞ¢¶¶W’ÓÓÒ&Gf–6R"bbÇ7ãç·7VvvW7F–öä6÷VçGÓÂ÷7ãçĞ¢Âö'WGFöãà¢’—Ğ¢ÂöF—cà ¢¶æÇ—6—5F"ÓÓÒ&ÖF6‚"bbÄÖF6…&W÷'BæÇ—6—3×·&W7VÇGÒ7VvvW7F–öä6÷VçC×·7VvvW7F–öä6÷VçGÒvô÷F–Ö—¦S×¶vô÷F–Ö—¦WÒóçĞ¢¶æÇ—6—5F"ÓÓÒ&¶W—v÷&G2"bbÄ¶W—v÷&E&W÷'BæÇ—6—3×·&W7VÇGÒóçĞ¢¶æÇ—6—5F"ÓÓÒ&Gf–6R"bbÄGf–6U&W÷'B7VvvW7F–öç3×·7VvvW7F–öç7Òvô÷F–Ö—¦S×¶vô÷F–Ö—¦WÒóçĞ¢¶æÇ—6—5F"ÓÓÒ&–çFW'f–Wr"bbÄ–çFW'f–Wu&W÷'BVW7F–öç3×·&W7VÇBçVW7F–öç7ÒóçĞ¢Â÷6V7F–öãà¢—Ğ¢ÂöF—cà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâÖF6…&W÷'B‡°¢æÇ—6—2À¢7VvvW7F–öä6÷VçBÀ¢vô÷F–Ö—¦RÀ§Ó¢°¢æÇ—6—3¢¤DæÇ—6—5&W7VÇC°¢7VvvW7F–öä6÷VçC¢çVÖ&W#°¢vô÷F–Ö—¦S¢‚’Óâfö–C°§Ò’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB#à¢ÆF—b6Æ74æÖSÒ&'&V¶F÷vâÖw&–B#à¢µ°¢².X[>™JîŠøŞŠhny¹b"ÂæÇ—6—2ç66÷&RÂG¶æÇ—6—2æÖF6†VBæÆVæwF‡ÒòG¶æÇ—6—2æ¶W—v÷&G2æÆVæwF‡ÒKŠ®X[>™JîŠøŞ[{.iÈKÙ>xëÒÀ¢².[)~KØŞ{Ë®ZKš’"ÂÖF‚æÖ‚ƒÂÒæÇ—6—2ç66÷&R’ÂG¶æÇ—6—2æÖ—76–æræÆVæwF‡ÒšŠhk.[	®iÊ®YÊzèXènKŠŞKÙ>xëÒÀ¢².h‰iéÎŠ‹ëâ"ÂcÂ.Šû~K«®[z^j8iú^iŠşY
nXÈ^Y
¾Xúşš¨ÎŠøy¨NXªKÙÎKˆî{¹>iéÂ%ÒÀ¢².K¨¾ZéîZèXZ‚"ÂÂ.ŠxNX‰XˆniéKˆŞKÉ®Y	zèXènk{¾XªKˆŞZÙYÊy¨NKúhò%ÒÀ¢ÒæÖ‚…¶Æ&VÂÂ66÷&RÂæ÷FUÒ’Óâ€¢ÆF—b6Æ74æÖSÒ&'&V¶F÷vâÖ6&B"¶W“×µ7G&–ær†Æ&VÂ—Óà¢ÆF—cãÇ7G&öæsç¶Æ&VÇÓÂ÷7G&öæsãÇ7ãç·66÷&WÓÂ÷7ããÂöF—cà¢Æ“ãÆ"7G–ÆS×·²v–GFƒ¢G·66÷&WÒV×ÒóãÂö“à¢Çç¶æ÷FWÓÂ÷à¢ÂöF—cà¢’—Ğ¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&Wf–FVæ6RÖw&–B#à¢Ç6V7F–öâ6Æ74æÖSÒ&Wf–FVæ6RÖ6&B7G&VæwF‚#à¢ÆF—b6Æ74æÖSÒ&Wf–FVæ6RÖ†VB#à¢Ç7ãî)É3Â÷7ãà¢ÆF—cãÆƒ3îzèXènKÉX«óÂöƒ3ãÇç¶æÇ—6—2æÖF6†VBæÆVæwF‡ÒšŠhk.[{.iÈih~ZÙ~ŠøhÚãÂ÷ãÂöF—cà¢ÂöF—cà¢²†æÇ—6—2æÖF6†VBæÆVæwF‚òæÇ—6—2æÖF6†VB¢².i¨.iziˆîzîXË˜XŞš’%Ò’æÖ‚‡F—FÆR’Óâ€¢ÆF—b6Æ74æÖSÒ&Wf–FVæ6R×&÷r"¶W“×·F—FÆWÓà¢Ç7G&öæsç·F—FÆWÓÂ÷7G&öæsãÇîzèXènjÚ>ih~KŠŞj8kX¾X‹Zû[©NX[>™JîŠøÓÂ÷ãÆVÓî[{.XË˜XÓÂöVÓà¢ÂöF—cà¢’—Ğ¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&Wf–FVæ6RÖ6&Bv#à¢ÆF—b6Æ74æÖSÒ&Wf–FVæ6RÖ†VB#à¢Ç7ãâÂ÷7ãà¢ÆF—cãÆƒ3îi¨.iÊ®KÙ>xëÂöƒ3ãÇîKˆŞiŠşˆ;ŞX©¾{¹>Šë®ûÈÎXú®Kº>ŠzèXènizŠøhÚãÂ÷ãÂöF—cà¢ÂöF—cà¢²†æÇ—6—2æÖ—76–æræÆVæwF‚òæÇ—6—2æÖ—76–ær¢².iz%Ò’æÖ‚‡F—FÆR’Óâ€¢ÆF—b6Æ74æÖSÒ&Wf–FVæ6R×&÷r"¶W“×·F—FÆWÓà¢Ç7G&öæsç·F—FÆWÓÂ÷7G&öæsãÇä¤BKŠŞX{®xëûÈÎKØnzèXènjÚ>ih~iÊ®j8kX¾X‹Â÷ãÆVÓî[è^zîŠêCÂöVÓà¢ÂöF—cà¢’—Ğ¢Â÷6V7F–öãà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ7F#à¢ÆF—cãÇ7G&öæsî[{.yIşh‰·7VvvW7F–öä6÷VçGÒiÚŠxNX‰[»®ŠêãÂ÷7G&öæsãÇ7ãî{Ë®ZKh¨ˆ;ŞKˆŞKÉ®ˆz®XªXiXZ^zèXècÂ÷7ããÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ&'Fâ&–Ö'’"öä6Æ–6³×¶vô÷F–Ö—¦WÓîiú^yÈ¾KÉXÉnZûjùB(i#Âö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâ¶W—v÷&E&W÷'B‡²æÇ—6—2Ó¢²æÇ—6—3¢¤DæÇ—6—5&W7VÇBÒ’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB¶W—v÷&BÖ6öçFVçB#à¢Ç6V7F–öãà¢Æƒ3îzÎh
~Šhk#Âöƒ3à¢ÆF—b6Æ74æÖSÒ&¶W—v÷&BÖ6Æ÷VB#à¢²†æÇ—6—2æ¶W—v÷&G2æÆVæwF‚òæÇ—6—2æ¶W—v÷&G2¢².i¨.iÊ®ŠønXŠ¾X‹[‹Šxh¨iÊşX[>™JîŠøÒ%Ò’æÖ€¢†¶W—v÷&B’Óâ€¢Ç7â6Æ74æÖS×¶æÇ—6—2æÖF6†VBæ–æ6ÇVFW2†¶W—v÷&B’ò&ÖF6†VB"¢"'Ò¶W“×¶¶W—v÷&GÓà¢¶æÇ—6—2æÖF6†VBæ–æ6ÇVFW2†¶W—v÷&B’ò.)É2"¢"'×¶¶W—v÷&GĞ¢Â÷7ãà¢’À¢—Ğ¢ÂöF—cà¢Â÷6V7F–öãà¢Ç6V7F–öãà¢Æƒ3î‹Úşh
~ˆ;ŞX©³Âöƒ3à¢ÆF—b6Æ74æÖSÒ&¶W—v÷&BÖ6Æ÷VB6ögB#à¢µ².k)ş˜	®XØşKÙÂ"Â.ZÚnKšˆ;ŞX©²"Â.™zîš)Zé®KØÒ"Â.™Èk.ynŠz2%ÒæÖ‚†¶W—v÷&B’Óâ€¢Ç7â¶W“×¶¶W—v÷&GÓç¶¶W—v÷&GÓÂ÷7ãà¢’—Ğ¢ÂöF—cà¢Â÷6V7F–öãà¢Ç6V7F–öâ6Æ74æÖSÒ&–çfÆ–BÖ6÷’#à¢Ç7ãîKØîzÙ¾˜K»~XÎhøş‹ûÂ÷7ãà¢Çî(	ÎX[~ZH~ˆšşZ[Şy¨Nk)ş˜	®ˆ;ŞX©¾Y(ÎZÚnKšˆ;ŞX©¾(	Ş[îK¨î˜	®yJhøş‹ûûÈÎ™ÈŠhyJ{¸şXènŠøhÚîiJşi)8#Â÷à¢Â÷6V7F–öãà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâGf–6U&W÷'B‡°¢7VvvW7F–öç2À¢vô÷F–Ö—¦RÀ§Ó¢°¢7VvvW7F–öç3¢7VvvW7F–öåµÓ°¢vô÷F–Ö—¦S¢‚’Óâfö–C°§Ò’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB#à¢ÆF—b6Æ74æÖSÒ&Gf–6RÖÆ—7B#à¢·7VvvW7F–öç2æÖ‚‡7VvvW7F–öâÂ–æFW‚’Óâ€¢ÆF—b6Æ74æÖSÒ&Gf–6R×&÷r"¶W“×·7VvvW7F–öâæ–GÓà¢Ç7ãçµ7G&–ær†–æFW‚²’çE7F'Bƒ"Â#"—ÓÂ÷7ãà¢ÆF—cãÇ7G&öæsç·7VvvW7F–öâæ¶–æGÓÂ÷7G&öæsãÇç·7VvvW7F–öâæÖöGVÆWÒ+r·7VvvW7F–öâç&V6öçÓÂ÷ãÂöF—cà¢ÆVÓç·7VvvW7F–öâç6fRò.ZèXZ[»®Šêâ"¢.™ÈŠhzîŠêB'ÓÂöVÓà¢ÂöF—cà¢’—Ğ¢ÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ&'Fâ&–Ö'’v–FR"öä6Æ–6³×¶vô÷F–Ö—¦WÓî˜	iÚiú^yÈ¾KúîiKX˜ŞYãÂö'WGFöãà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâ–çFW'f–Wu&W÷'B‡°¢VW7F–öç2À§Ó¢°¢VW7F–öç3¢·7G&–ærÂ7G&–ærÂ7G&–æuÕµÓ°§Ò’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB–çFW'f–WrÖÆ—7B#à¢·VW7F–öç2æÖ‚…·FrÂVW7F–öâÂ6÷W&6UÒÂ–æFW‚’Óâ€¢Æ'F–6ÆR¶W“×·VW7F–öçÓà¢Ç7ãç¶–æFW‚²ÓÂ÷7ãà¢ÆF—cãÆVÓç·FwÓÂöVÓãÆƒ3ç·VW7F–öçÓÂöƒ3ãÇç·6÷W&6WÓÂ÷ãÂöF—cà¢Æ'WGFöãîXxnZH~Šhx+’ûÈ³Âö'WGFöãà¢Âö'F–6ÆSà¢’—Ğ¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâ÷F–Ö—¦UvR‡°¢7VvvW7F–öç2À¢F&vWBÀ¢6VÆV7FVBÀ¢6WE6VÆV7FVBÀ¢WFFU7VvvW7F–öâÀ¢6fRÀ¢&6²À§Ó¢°¢7VvvW7F–öç3¢7VvvW7F–öåµÓ°¢F&vWC¢7G&–æs°¢6VÆV7FVC¢çVÖ&W#°¢6WE6VÆV7FVC¢†–C¢çVÖ&W"’Óâfö–C°¢WFFU7VvvW7F–öã¢†–C¢çVÖ&W"Â7FGW3¢7VvvW7F–öå²'7FGW2%Ò’Óâfö–C°¢6fS¢‚’Óâfö–C°¢&6³¢‚’Óâfö–C°§Ò’°¢6öç7B—FVÒÒ7VvvW7F–öç2æf–æB‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâæ–BÓÓÒ6VÆV7FVB’óò7VvvW7F–öç5³Ó°¢6öç7B66WFVBÒ7VvvW7F–öç2æf–ÇFW"‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâç7FGW2ÓÓÒ&66WFVB"’æÆVæwFƒ°¢6öç7BFV6–FVBÒ7VvvW7F–öç2æf–ÇFW"‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâç7FGW2ÓÒ'VæF–ær"’æÆVæwFƒ°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ&÷F–Ö—¦R×vR#à¢Æ†VFW"6Æ74æÖSÒ&÷F–Ö—¦R×F÷&"#à¢ÆF—cà¢Æ'WGFöâöä6Æ–6³×¶&6·Óî(i‹ùNY¹îXˆniéÂö'WGFöãà¢ÆF—cà¢Ç6Æ74æÖSÒ&W–V'&÷r#îŠxNX‰KÉXÉnZûjùCÂ÷à¢Æƒç·F&vWGÒ+r¤BZé®Y	KÉXÉcÂöƒà¢ÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ&FV6—6–öâ×&öw&W72#à¢Ç7ãç¶FV6–FVGÒò·7VvvW7F–öç2æÆVæwF‡Ò[{.ZHNycÂ÷7ãà¢Æ“ãÆ"7G–ÆS×·²v–GFƒ¢G²†FV6–FVBò7VvvW7F–öç2æÆVæwF‚’¢ÒV×ÒóãÂö“à¢ÂöF—cà¢Æ'WGFöâ6Æ74æÖSÒ&'Fâ&–Ö'’"öä6Æ–6³×·6fWÓîKùŞZÙK‹®ikx˜iÊÃÂö'WGFöãà¢Âö†VFW#à ¢ÆF—b6Æ74æÖSÒ&÷F–Ö—¦R×v÷&·76R#à¢Æ6–FR6Æ74æÖSÒ'7VvvW7F–öâÖÆ—7B#à¢ÆF—b6Æ74æÖSÒ'7VvvW7F–öâÖÆ—7BÖ†VB#à¢ÆF—cãÇ7G&öæsîKúîiK[»®ŠêãÂ÷7G&öæsãÇ7ãç·7VvvW7F–öç2æÆVæwF‡ÓÂ÷7ããÂöF—cà¢Ç6ÖÆÃî˜	iÚzîŠêNYîXhŞKùŞZÙƒÂ÷6ÖÆÃà¢ÂöF—cà¢·7VvvW7F–öç2æÖ‚‡7VvvW7F–öâÂ–æFW‚’Óâ€¢Æ'WGFöà¢¶W“×·7VvvW7F–öâæ–GĞ¢6Æ74æÖS×·6VÆV7FVBÓÓÒ7VvvW7F–öâæ–Bò'7VvvW7F–öâÖæb7F—fR"¢'7VvvW7F–öâÖæb'Ğ¢öä6Æ–6³×²‚’Óâ6WE6VÆV7FVB‡7VvvW7F–öâæ–B—Ğ¢à¢Ç7â6Æ74æÖS×¶7FGW2ÖF÷BG·7VvvW7F–öâç7FGW7ÖÓç·7VvvW7F–öâç7FGW2ÓÓÒ&66WFVB"ò.)É2"¢7VvvW7F–öâç7FGW2ÓÓÒ'&V¦V7FVB"ò,9r"¢–æFW‚²ÓÂ÷7ãà¢ÆF—cãÇ7G&öæsç·7VvvW7F–öâæ¶–æGÓÂ÷7G&öæsãÇ6ÖÆÃç·7VvvW7F–öâæÖöGVÆWÒ+r·7VvvW7F–öâæ¶W—v÷&GÓÂ÷6ÖÆÃãÂöF—cà¢ÆVÓç·7VvvW7F–öâç6fRò.ZèXZ‚"¢.™ÈŠ^XXR'ÓÂöVÓà¢Âö'WGFöãà¢’—Ğ¢ÆF—b6Æ74æÖSÒ&f7BÖwV&B#à¢Ç7ãîK¨¾ZéîKùŞhªN[{.[ÈY
óÂ÷7ãà¢ÇîikZ)îi[ZÙ~8h¨ˆ;Şh‰nh‰iéÎi{nûÈÎ[ø^š¾XXyKKÚŠ^XX^yÉşZéîKúhş8#Â÷à¢ÂöF—cà¢Âö6–FSà ¢Ç6V7F–öâ6Æ74æÖSÒ&6ö×&—6öâÖ&V#à¢ÆF—b6Æ74æÖSÒ&6ö×&—6öâÖ†VF–ær#à¢ÆF—cà¢Ç7â6Æ74æÖS×¶—FVÒç6fRò'6fRÖ&FvR"¢'v&æ–ærÖ&FvR'Óà¢¶—FVÒç6fRò.)É2K¨¾ZéîZèXZ‚"¢"™ÈŠhyÉşZéîKúhò'Ğ¢Â÷7ãà¢Æƒ#ç¶—FVÒæ¶–æGÓÂöƒ#à¢Çç¶—FVÒç&V6öçÓÂ÷à¢ÂöF—cà¢Ç7â6Æ74æÖSÒ&¶W—v÷&B×&VfW&Væ6R#îZû[©B¤NûÉ§¶—FVÒæ¶W—v÷&GÓÂ÷7ãà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&6ö×&—6öâÖw&–B#à¢Æ'F–6ÆR6Æ74æÖSÒ&6ö×&RÖ6&B÷&–v–æÂ#à¢Æ†VFW#ãÇ7ãîKúîiKX˜ÓÂ÷7ããÆVÓîXéşZx¾zèXècÂöVÓãÂö†VFW#à¢ÆF—b6Æ74æÖSÒ&6ö×&RÖÖöGVÆRÖÆ&VÂ#ç¶—FVÒæÖöGVÆWÓÂöF—cà¢Çç¶—FVÒæ÷&–v–æÇÓÂ÷à¢Âö'F–6ÆSà¢Æ'F–6ÆR6Æ74æÖSÒ&6ö×&RÖ6&B÷F–Ö—¦VB#à¢Æ†VFW#ãÇ7ãîKúîiKYãÂ÷7ããÆVÓîŠxNX‰[»®Šêîš(NŠxƒÂöVÓãÂö†VFW#à¢ÆF—b6Æ74æÖSÒ&6ö×&RÖÖöGVÆRÖÆ&VÂ#ç¶—FVÒæÖöGVÆWÓÂöF—cà¢Çç¶—FVÒæ÷F–Ö—¦VGÓÂ÷à¢²—FVÒç6fRbb€¢ÆF—b6Æ74æÖSÒ'Vç6fRÖæ÷FR#î8	8	KŠŞy¨NXh^Zë[ø^š¾yKKÚZ¾XiûÈÎ[Ù>X˜Şx˜iÊÎKˆŞKÉ®XiXZ^zèXèn8#ÂöF—cà¢—Ğ¢Âö'F–6ÆSà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&6†ævRÖW‡ÆæF–öâ#à¢Ç7ãîKúîiKŠûNiˆãÂ÷7ãà¢Çç¶—FVÒç&V6öçÓÂ÷à¢ÆF—cà¢ÆVÓîiÊ®KúîiKi{n™{CÂöVÓãÆVÓîiÊ®k{¾Xªh¨ˆ;ÓÂöVÓãÆVÓîiÊ®‰™®ièNh‰iéÃÂöVÓà¢ÂöF—cà¢ÂöF—cà ¢ÆF—b6Æ74æÖSÒ&FV6—6–öâÖ7F–öç2#à¢Æ'WGFöà¢6Æ74æÖS×¶—FVÒç7FGW2ÓÓÒ'&V¦V7FVB"ò'&V¦V7B7F—fR"¢'&V¦V7B'Ğ¢öä6Æ–6³×²‚’ÓâWFFU7VvvW7F–öâ†—FVÒæ–BÂ'&V¦V7FVB"—Ğ¢à¢9rKùŞyYXéşihp¢Âö'WGFöãà¢Ç7ãîKÚy¨N˜hºXúşKº^™¨şi{ni»NiK“Â÷7ãà¢Æ'WGFöà¢6Æ74æÖS×¶—FVÒç7FGW2ÓÓÒ&66WFVB"ò&66WB7F—fR"¢&66WB'Ğ¢öä6Æ–6³×²‚’ÓâWFFU7VvvW7F–öâ†—FVÒæ–BÂ&66WFVB"—Ğ¢F—6&ÆVC×²—FVÒç6fWĞ¢à¢)É2¶—FVÒç6fRò.hê^Xù~KúîiK’"¢.Š^XX^YîXúşhê^Xùr'Ğ¢Âö'WGFöãà¢ÂöF—cà¢Â÷6V7F–öãà ¢Æ6–FR6Æ74æÖSÒ&÷F–Ö—¦F–öâ×7VÖÖ'’#à¢Ç7â6Æ74æÖSÒ'æVÂÖ¶–6¶W"#îx˜iÊÎiŠhÂ÷7ãà¢Æƒ3î[Ù>X˜ŞXk>zÙcÂöƒ3à¢ÆF—b6Æ74æÖSÒ&FV6—6–öâ×7FB#à¢ÆF—cãÇ7G&öæsç¶66WFVGÓÂ÷7G&öæsãÇ7ãî[{.hê^XùsÂ÷7ããÂöF—cà¢ÆF—cãÇ7G&öæsç·7VvvW7F–öç2æf–ÇFW"‚‡2’Óâ2ç7FGW2ÓÓÒ'&V¦V7FVB"’æÆVæwF‡ÓÂ÷7G&öæsãÇ7ãî[{.h¹.{¹ÓÂ÷7ããÂöF—cà¢ÂöF—cà¢ÆF—b6Æ74æÖSÒ'7VÖÖ'’ÖF—f–FW""óà¢ÆƒCî[nKª~yIşy¨NXùXÉcÂöƒCà¢ÇVÃà¢ÆÆ“îy»X[>{¸şXènhé.[¨şi»Nkˆ^i›ÂöÆ“à¢ÆÆ“ä¦fòôõX[>™JîŠøŞi»Nz¨X{£ÂöÆ“à¢ÆÆ“îXéşZx¾x˜iÊÎZèÎi[NKùŞyY“ÂöÆ“à¢Â÷VÃà¢Æ'WGFöâ6Æ74æÖSÒ&'FâF&²v–FR"öä6Æ–6³×·6fWÓîZèÎh‰[›nKùŞZÙx˜iÊÃÂö'WGFöãà¢ÇîKùŞZÙYîXúş{º~{ºŞh˜¾Xª[êî‹3Â÷à¢Âö6–FSà¢ÂöF—cà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâf–VÆB‡°¢Æ&VÂÀ¢fÇVRÀ¢öä6†ævRÀ§Ó¢°¢Æ&VÃ¢7G&–æs°¢fÇVS¢7G&–æs°¢öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°§Ò’°¢&WGW&â€¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆB#à¢Ç7ãç¶Æ&VÇÓÂ÷7ãà¢Æ–çWBfÇVS×·fÇVWÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—Òóà¢ÂöÆ&VÃà¢“°§Ğ ¦gVæ7F–öâFW‡Df–VÆB‡°¢Æ&VÂÀ¢fÇVRÀ¢öä6†ævRÀ¢†–çBÀ¢&÷w2ÒBÀ§Ó¢°¢Æ&VÃ¢7G&–æs°¢fÇVS¢7G&–æs°¢öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°¢†–çCó¢7G&–æs°¢&÷w3ó¢çVÖ&W#°§Ò’°¢&WGW&â€¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆB#à¢Ç7ãç¶Æ&VÇÓÂ÷7ãà¢ÇFW‡F&V¢&÷w3×·&÷w7Ğ¢fÇVS×·fÇVWĞ¢öä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—Ğ¢óà¢¶†–çBbbÇ6ÖÆÃç¶†–çGÓÂ÷6ÖÆÃçĞ¢ÂöÆ&VÃà¢“°§Ğ ¦gVæ7F–öâ6Ö'D†–çB‡²&ö¦V7BÒfÇ6RÓ¢²&ö¦V7Có¢&ööÆVâÒ’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'6Ö'BÖ†–çB#à¢Ç7â6Æ74æÖSÒ&†–çBÖ–6öâ#îhùzK£Â÷7ãà¢ÆF—cà¢Ç7G&öæsç·&ö¦V7Bò.‹ùjë^šyºî{¸şXèn‹ùXúşKº^i»NX[~KÙ2"¢.[»®ŠêîŠ^XX^Xúşš¨ÎŠøy¨NKúhò'ÓÂ÷7G&öæsà¢Çà¢·&ö¦V7@¢ò.KÚŠz>Xk>K¨nK¸K˜X[~KÙ>™zîš)ûÉşY:®K©¾˜:XˆnyKKÚxºÎz¸¾ZèÎh‰ûÉò ¢¢.KÛşyJK¨nK¸K˜[z^X[~ûÉşi[hÚîŠxNjŠZI®ZJ~ûÉşiÈ{¸Kª~yIşK¨nK¸K˜{¹>iéÎûÉò'Ğ¢Â÷à¢ÂöF—cà¢Æ'WGFöãîiú^yÈ¾Xik9SÂö'WGFöãà¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâG'WF„æ÷F–6R‚’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ'G'WF‚Öæ÷F–6R#à¢Ç7ãîy»ãÂ÷7ãà¢ÇãÇ7G&öæsîyÉşZéîKúhşKùŞhªCÂ÷7G&öæsîXiKÙÎhùzK®Xú®Yû®K¨îKÚ[{.Z¾Xiy¨NXh^ZëûÈÎKˆŞKÉ®k{¾XªKˆŞZÙYÊy¨N{¸şXèn8h¨ˆ;Şh‰ni[hÚî8#Â÷à¢ÂöF—cà¢“°§Ğ ¦gVæ7F–öâÖöFÂ‡°¢F—FÆRÀ¢öä6Æ÷6RÀ¢6†–ÆG&VâÀ§Ó¢°¢F—FÆS¢7G&–æs°¢öä6Æ÷6S¢‚’Óâfö–C°¢6†–ÆG&Vã¢&V7Bå&V7DæöFS°§Ò’°¢&WGW&â€¢ÆF—b6Æ74æÖSÒ&ÖöFÂÖ&6¶G&÷"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×¶öä6Æ÷6WÓà¢Ç6V7F–öà¢6Æ74æÖSÒ&ÖöFÂ ¢&öÆSÒ&F–Æör ¢&–ÖÖöFÃÒ'G'VR ¢&–ÖÆ&VÃ×·F—FÆWĞ¢öäÖ÷W6TF÷vã×²†WfVçB’ÓâWfVçBç7F÷&÷vF–öâ‚—Ğ¢à¢Æ†VFW#ãÆƒ#ç·F—FÆWÓÂöƒ#ãÆ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÓì9sÂö'WGFöããÂö†VFW#à¢¶6†–ÆG&VçĞ¢Â÷6V7F–öãà¢ÂöF—cà¢“°§Ğ