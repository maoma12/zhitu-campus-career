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
type ModuleKey =
  | "basic"
  | "experience"
  | "education"
  | "project"
  | "skills"
  | "certificate"
  | "evaluation"
  | "portfolio";

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

const moduleMeta: Record<ModuleKey, { label: string; icon: string }> = {
  basic: { label: "åŸºæœ¬ä¿¡æ¯", icon: "äºº" },
  experience: { label: "å®ä¹ ç»å†", icon: "å†" },
  education: { label: "æ•™è‚²ç»å†", icon: "å­¦" },
  project: { label: "é¡¹ç›®ç»å†", icon: "é¡¹" },
  skills: { label: "æŠ€èƒ½ç‰¹é•¿", icon: "æŠ€" },
  certificate: { label: "è¯ä¹¦è£èª‰", icon: "è¯" },
  evaluation: { label: "è‡ªæˆ‘è¯„ä»·", icon: "è¯„" },
  portfolio: { label: "ä½œå“å±•ç¤º", icon: "é“¾" },
};

const defaultOrder: ModuleKey[] = [
  "basic",
  "experience",
  "education",
  "project",
  "skills",
  "certificate",
  "evaluation",
  "portfolio",
];

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

const jdSample = `Java.6ÛŸ-¢G§²ÚîÆ­yÓÆƒ3îzÎh
~Šhk#Âöƒ3àĞ¢ÆF—b6Æ74æÖSÒ&¶W—v÷&BÖ6Æ÷VB#àĞ¢²†æÇ—6—2æ¶W—v÷&G2æÆVæwF‚òæÇ—6—2æ¶W—v÷&G2¢².i¨.iÊ®ŠønXŠ¾X‹[‹Šxh¨iÊşX[>™JîŠøÒ%Ò’æÖ€Ğ¢†¶W—v÷&B’Óâ€Ğ¢Ç7â6Æ74æÖS×¶æÇ—6—2æÖF6†VBæ–æ6ÇVFW2†¶W—v÷&B’ò&ÖF6†VB"¢"'Ò¶W“×¶¶W—v÷&GÓàĞ¢¶æÇ—6—2æÖF6†VBæ–æ6ÇVFW2†¶W—v÷&B’ò.)É2"¢"'×¶¶W—v÷&GĞĞ¢Â÷7ãàĞ¢’ÀĞ¢—ĞĞ¢ÂöF—càĞ¢Â÷6V7F–öãàĞ¢Ç6V7F–öãàĞ¢Æƒ3î‹Úşh
~ˆ;ŞX©³Âöƒ3àĞ¢ÆF—b6Æ74æÖSÒ&¶W—v÷&BÖ6Æ÷VB6ögB#àĞ¢µ².k)ş˜	®XØşKÙÂ"Â.ZÚnKšˆ;ŞX©²"Â.™zîš)Zé®KØÒ"Â.™Èk.ynŠz2%ÒæÖ‚†¶W—v÷&B’Óâ€Ğ¢Ç7â¶W“×¶¶W—v÷&GÓç¶¶W—v÷&GÓÂ÷7ãàĞ¢’—ĞĞ¢ÂöF—càĞ¢Â÷6V7F–öãàĞ¢Ç6V7F–öâ6Æ74æÖSÒ&–çfÆ–BÖ6÷’#àĞ¢Ç7ãîKØîzÙ¾˜K»~XÎhøş‹ûÂ÷7ãàĞ¢Çî(	ÎX[~ZH~ˆšşZ[Şy¨Nk)ş˜	®ˆ;ŞX©¾Y(ÎZÚnKšˆ;ŞX©¾(	Ş[îK¨î˜	®yJhøş‹ûûÈÎ™ÈŠhyJ{¸şXènŠøhÚîiJşi)8#Â÷àĞ¢Â÷6V7F–öãàĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâGf–6U&W÷'B‡°Ğ¢7VvvW7F–öç2ÀĞ¢vô÷F–Ö—¦RÀĞ§Ó¢°Ğ¢7VvvW7F–öç3¢7VvvW7F–öåµÓ°Ğ¢vô÷F–Ö—¦S¢‚’Óâfö–C°Ğ§Ò’°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB#àĞ¢ÆF—b6Æ74æÖSÒ&Gf–6RÖÆ—7B#àĞ¢·7VvvW7F–öç2æÖ‚‡7VvvW7F–öâÂ–æFW‚’Óâ€Ğ¢ÆF—b6Æ74æÖSÒ&Gf–6R×&÷r"¶W“×·7VvvW7F–öâæ–GÓàĞ¢Ç7ãçµ7G&–ær†–æFW‚²’çE7F'Bƒ"Â#"—ÓÂ÷7ãàĞ¢ÆF—cãÇ7G&öæsç·7VvvW7F–öâæ¶–æGÓÂ÷7G&öæsãÇç·7VvvW7F–öâæÖöGVÆWÒ+r·7VvvW7F–öâç&V6öçÓÂ÷ãÂöF—càĞ¢ÆVÓç·7VvvW7F–öâç6fRò.ZèXZ[»®Šêâ"¢.™ÈŠhzîŠêB'ÓÂöVÓàĞ¢ÂöF—càĞ¢’—ĞĞ¢ÂöF—càĞ¢Æ'WGFöâ6Æ74æÖSÒ&'Fâ&–Ö'’v–FR"öä6Æ–6³×¶vô÷F–Ö—¦WÓî˜	iÚiú^yÈ¾KúîiKX˜ŞYãÂö'WGFöãàĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâ–çFW'f–Wu&W÷'B‡°Ğ¢VW7F–öç2ÀĞ§Ó¢°Ğ¢VW7F–öç3¢·7G&–ærÂ7G&–ærÂ7G&–æuÕµÓ°Ğ§Ò’°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ'&W7VÇBÖ6öçFVçB–çFW'f–WrÖÆ—7B#àĞ¢·VW7F–öç2æÖ‚…·FrÂVW7F–öâÂ6÷W&6UÒÂ–æFW‚’Óâ€Ğ¢Æ'F–6ÆR¶W“×·VW7F–öçÓàĞ¢Ç7ãç¶–æFW‚²ÓÂ÷7ãàĞ¢ÆF—cãÆVÓç·FwÓÂöVÓãÆƒ3ç·VW7F–öçÓÂöƒ3ãÇç·6÷W&6WÓÂ÷ãÂöF—càĞ¢Æ'WGFöãîXxnZH~Šhx+’ûÈ³Âö'WGFöãàĞ¢Âö'F–6ÆSàĞ¢’—ĞĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâ÷F–Ö—¦UvR‡°Ğ¢7VvvW7F–öç2ÀĞ¢F&vWBÀĞ¢6VÆV7FVBÀĞ¢6WE6VÆV7FVBÀĞ¢WFFU7VvvW7F–öâÀĞ¢6fRÀĞ¢&6²ÀĞ§Ó¢°Ğ¢7VvvW7F–öç3¢7VvvW7F–öåµÓ°Ğ¢F&vWC¢7G&–æs°Ğ¢6VÆV7FVC¢çVÖ&W#°Ğ¢6WE6VÆV7FVC¢†–C¢çVÖ&W"’Óâfö–C°Ğ¢WFFU7VvvW7F–öã¢†–C¢çVÖ&W"Â7FGW3¢7VvvW7F–öå²'7FGW2%Ò’Óâfö–C°Ğ¢6fS¢‚’Óâfö–C°Ğ¢&6³¢‚’Óâfö–C°Ğ§Ò’°Ğ¢6öç7B—FVÒÒ7VvvW7F–öç2æf–æB‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâæ–BÓÓÒ6VÆV7FVB’óò7VvvW7F–öç5³Ó°Ğ¢6öç7B66WFVBÒ7VvvW7F–öç2æf–ÇFW"‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâç7FGW2ÓÓÒ&66WFVB"’æÆVæwFƒ°Ğ¢6öç7BFV6–FVBÒ7VvvW7F–öç2æf–ÇFW"‚‡7VvvW7F–öâ’Óâ7VvvW7F–öâç7FGW2ÓÒ'VæF–ær"’æÆVæwFƒ°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ&÷F–Ö—¦R×vR#àĞ¢Æ†VFW"6Æ74æÖSÒ&÷F–Ö—¦R×F÷&"#àĞ¢ÆF—càĞ¢Æ'WGFöâöä6Æ–6³×¶&6·Óî(i‹ùNY¹îXˆniéÂö'WGFöãàĞ¢ÆF—càĞ¢Ç6Æ74æÖSÒ&W–V'&÷r#îŠxNX‰KÉXÉnZûjùCÂ÷àĞ¢Æƒç·F&vWGÒ+r¤BZé®Y	KÉXÉcÂöƒàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ&FV6—6–öâ×&öw&W72#àĞ¢Ç7ãç¶FV6–FVGÒò·7VvvW7F–öç2æÆVæwF‡Ò[{.ZHNycÂ÷7ãàĞ¢Æ“ãÆ"7G–ÆS×·²v–GFƒ¢G²†FV6–FVBò7VvvW7F–öç2æÆVæwF‚’¢ÒV×ÒóãÂö“àĞ¢ÂöF—càĞ¢Æ'WGFöâ6Æ74æÖSÒ&'Fâ&–Ö'’"öä6Æ–6³×·6fWÓîKùŞZÙK‹®ikx˜iÊÃÂö'WGFöãàĞ¢Âö†VFW#àĞ Ğ¢ÆF—b6Æ74æÖSÒ&÷F–Ö—¦R×v÷&·76R#àĞ¢Æ6–FR6Æ74æÖSÒ'7VvvW7F–öâÖÆ—7B#àĞ¢ÆF—b6Æ74æÖSÒ'7VvvW7F–öâÖÆ—7BÖ†VB#àĞ¢ÆF—cãÇ7G&öæsîKúîiK[»®ŠêãÂ÷7G&öæsãÇ7ãç·7VvvW7F–öç2æÆVæwF‡ÓÂ÷7ããÂöF—càĞ¢Ç6ÖÆÃî˜	iÚzîŠêNYîXhŞKùŞZÙƒÂ÷6ÖÆÃàĞ¢ÂöF—càĞ¢·7VvvW7F–öç2æÖ‚‡7VvvW7F–öâÂ–æFW‚’Óâ€Ğ¢Æ'WGFöàĞ¢¶W“×·7VvvW7F–öâæ–GĞĞ¢6Æ74æÖS×·6VÆV7FVBÓÓÒ7VvvW7F–öâæ–Bò'7VvvW7F–öâÖæb7F—fR"¢'7VvvW7F–öâÖæb'ĞĞ¢öä6Æ–6³×²‚’Óâ6WE6VÆV7FVB‡7VvvW7F–öâæ–B—ĞĞ¢àĞ¢Ç7â6Æ74æÖS×¶7FGW2ÖF÷BG·7VvvW7F–öâç7FGW7ÖÓç·7VvvW7F–öâç7FGW2ÓÓÒ&66WFVB"ò.)É2"¢7VvvW7F–öâç7FGW2ÓÓÒ'&V¦V7FVB"ò,9r"¢–æFW‚²ÓÂ÷7ãàĞ¢ÆF—cãÇ7G&öæsç·7VvvW7F–öâæ¶–æGÓÂ÷7G&öæsãÇ6ÖÆÃç·7VvvW7F–öâæÖöGVÆWÒ+r·7VvvW7F–öâæ¶W—v÷&GÓÂ÷6ÖÆÃãÂöF—càĞ¢ÆVÓç·7VvvW7F–öâç6fRò.ZèXZ‚"¢.™ÈŠ^XXR'ÓÂöVÓàĞ¢Âö'WGFöãàĞ¢’—ĞĞ¢ÆF—b6Æ74æÖSÒ&f7BÖwV&B#àĞ¢Ç7ãîK¨¾ZéîKùŞhªN[{.[ÈY
óÂ÷7ãàĞ¢ÇîikZ)îi[ZÙ~8h¨ˆ;Şh‰nh‰iéÎi{nûÈÎ[ø^š¾XXyKKÚŠ^XX^yÉşZéîKúhş8#Â÷àĞ¢ÂöF—càĞ¢Âö6–FSàĞ Ğ¢Ç6V7F–öâ6Æ74æÖSÒ&6ö×&—6öâÖ&V#àĞ¢ÆF—b6Æ74æÖSÒ&6ö×&—6öâÖ†VF–ær#àĞ¢ÆF—càĞ¢Ç7â6Æ74æÖS×¶—FVÒç6fRò'6fRÖ&FvR"¢'v&æ–ærÖ&FvR'ÓàĞ¢¶—FVÒç6fRò.)É2K¨¾ZéîZèXZ‚"¢"™ÈŠhyÉşZéîKúhò'ĞĞ¢Â÷7ãàĞ¢Æƒ#ç¶—FVÒæ¶–æGÓÂöƒ#àĞ¢Çç¶—FVÒç&V6öçÓÂ÷àĞ¢ÂöF—càĞ¢Ç7â6Æ74æÖSÒ&¶W—v÷&B×&VfW&Væ6R#îZû[©B¤NûÉ§¶—FVÒæ¶W—v÷&GÓÂ÷7ãàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ&6ö×&—6öâÖw&–B#àĞ¢Æ'F–6ÆR6Æ74æÖSÒ&6ö×&RÖ6&B÷&–v–æÂ#àĞ¢Æ†VFW#ãÇ7ãîKúîiKX˜ÓÂ÷7ããÆVÓîXéşZx¾zèXècÂöVÓãÂö†VFW#àĞ¢ÆF—b6Æ74æÖSÒ&6ö×&RÖÖöGVÆRÖÆ&VÂ#ç¶—FVÒæÖöGVÆWÓÂöF—càĞ¢Çç¶—FVÒæ÷&–v–æÇÓÂ÷àĞ¢Âö'F–6ÆSàĞ¢Æ'F–6ÆR6Æ74æÖSÒ&6ö×&RÖ6&B÷F–Ö—¦VB#àĞ¢Æ†VFW#ãÇ7ãîKúîiKYãÂ÷7ããÆVÓîŠxNX‰[»®Šêîš(NŠxƒÂöVÓãÂö†VFW#àĞ¢ÆF—b6Æ74æÖSÒ&6ö×&RÖÖöGVÆRÖÆ&VÂ#ç¶—FVÒæÖöGVÆWÓÂöF—càĞ¢Çç¶—FVÒæ÷F–Ö—¦VGÓÂ÷àĞ¢²—FVÒç6fRbb€Ğ¢ÆF—b6Æ74æÖSÒ'Vç6fRÖæ÷FR#î8	8	KŠŞy¨NXh^Zë[ø^š¾yKKÚZ¾XiûÈÎ[Ù>X˜Şx˜iÊÎKˆŞKÉ®XiXZ^zèXèn8#ÂöF—càĞ¢—ĞĞ¢Âö'F–6ÆSàĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ&6†ævRÖW‡ÆæF–öâ#àĞ¢Ç7ãîKúîiKŠûNiˆãÂ÷7ãàĞ¢Çç¶—FVÒç&V6öçÓÂ÷àĞ¢ÆF—càĞ¢ÆVÓîiÊ®KúîiKi{n™{CÂöVÓãÆVÓîiÊ®k{¾Xªh¨ˆ;ÓÂöVÓãÆVÓîiÊ®‰™®ièNh‰iéÃÂöVÓàĞ¢ÂöF—càĞ¢ÂöF—càĞ Ğ¢ÆF—b6Æ74æÖSÒ&FV6—6–öâÖ7F–öç2#àĞ¢Æ'WGFöàĞ¢6Æ74æÖS×¶—FVÒç7FGW2ÓÓÒ'&V¦V7FVB"ò'&V¦V7B7F—fR"¢'&V¦V7B'ĞĞ¢öä6Æ–6³×²‚’ÓâWFFU7VvvW7F–öâ†—FVÒæ–BÂ'&V¦V7FVB"—ĞĞ¢àĞ¢9rKùŞyYXéşihpĞ¢Âö'WGFöãàĞ¢Ç7ãîKÚy¨N˜hºXúşKº^™¨şi{ni»NiK“Â÷7ãàĞ¢Æ'WGFöàĞ¢6Æ74æÖS×¶—FVÒç7FGW2ÓÓÒ&66WFVB"ò&66WB7F—fR"¢&66WB'ĞĞ¢öä6Æ–6³×²‚’ÓâWFFU7VvvW7F–öâ†—FVÒæ–BÂ&66WFVB"—ĞĞ¢F—6&ÆVC×²—FVÒç6fWĞĞ¢àĞ¢)É2¶—FVÒç6fRò.hê^Xù~KúîiK’"¢.Š^XX^YîXúşhê^Xùr'ĞĞ¢Âö'WGFöãàĞ¢ÂöF—càĞ¢Â÷6V7F–öãàĞ Ğ¢Æ6–FR6Æ74æÖSÒ&÷F–Ö—¦F–öâ×7VÖÖ'’#àĞ¢Ç7â6Æ74æÖSÒ'æVÂÖ¶–6¶W"#îx˜iÊÎiŠhÂ÷7ãàĞ¢Æƒ3î[Ù>X˜ŞXk>zÙcÂöƒ3àĞ¢ÆF—b6Æ74æÖSÒ&FV6—6–öâ×7FB#àĞ¢ÆF—cãÇ7G&öæsç¶66WFVGÓÂ÷7G&öæsãÇ7ãî[{.hê^XùsÂ÷7ããÂöF—càĞ¢ÆF—cãÇ7G&öæsç·7VvvW7F–öç2æf–ÇFW"‚‡2’Óâ2ç7FGW2ÓÓÒ'&V¦V7FVB"’æÆVæwF‡ÓÂ÷7G&öæsãÇ7ãî[{.h¹.{¹ÓÂ÷7ããÂöF—càĞ¢ÂöF—càĞ¢ÆF—b6Æ74æÖSÒ'7VÖÖ'’ÖF—f–FW""óàĞ¢ÆƒCî[nKª~yIşy¨NXùXÉcÂöƒCàĞ¢ÇVÃàĞ¢ÆÆ“îy»X[>{¸şXènhé.[¨şi»Nkˆ^i›ÂöÆ“àĞ¢ÆÆ“ä¦fòôõX[>™JîŠøŞi»Nz¨X{£ÂöÆ“àĞ¢ÆÆ“îXéşZx¾x˜iÊÎZèÎi[NKùŞyY“ÂöÆ“àĞ¢Â÷VÃàĞ¢Æ'WGFöâ6Æ74æÖSÒ&'FâF&²v–FR"öä6Æ–6³×·6fWÓîZèÎh‰[›nKùŞZÙx˜iÊÃÂö'WGFöãàĞ¢ÇîKùŞZÙYîXúş{º~{ºŞh˜¾Xª[êî‹3Â÷àĞ¢Âö6–FSàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâf–VÆB‡°Ğ¢Æ&VÂÀĞ¢fÇVRÀĞ¢öä6†ævRÀĞ§Ó¢°Ğ¢Æ&VÃ¢7G&–æs°Ğ¢fÇVS¢7G&–æs°Ğ¢öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°Ğ§Ò’°Ğ¢&WGW&â€Ğ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆB#àĞ¢Ç7ãç¶Æ&VÇÓÂ÷7ãàĞ¢Æ–çWBfÇVS×·fÇVWÒöä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—ÒóàĞ¢ÂöÆ&VÃàĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâFW‡Df–VÆB‡°Ğ¢Æ&VÂÀĞ¢fÇVRÀĞ¢öä6†ævRÀĞ¢†–çBÀĞ¢&÷w2ÒBÀĞ§Ó¢°Ğ¢Æ&VÃ¢7G&–æs°Ğ¢fÇVS¢7G&–æs°Ğ¢öä6†ævS¢‡fÇVS¢7G&–ær’Óâfö–C°Ğ¢†–çCó¢7G&–æs°Ğ¢&÷w3ó¢çVÖ&W#°Ğ§Ò’°Ğ¢&WGW&â€Ğ¢ÆÆ&VÂ6Æ74æÖSÒ&f–VÆB#àĞ¢Ç7ãç¶Æ&VÇÓÂ÷7ãàĞ¢ÇFW‡F&VĞ¢&÷w3×·&÷w7ĞĞ¢fÇVS×·fÇVWĞĞ¢öä6†ævS×²†WfVçB’Óâöä6†ævR†WfVçBçF&vWBçfÇVR—ĞĞ¢óàĞ¢¶†–çBbbÇ6ÖÆÃç¶†–çGÓÂ÷6ÖÆÃçĞĞ¢ÂöÆ&VÃàĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâ6Ö'D†–çB‡²&ö¦V7BÒfÇ6RÓ¢²&ö¦V7Có¢&ööÆVâÒ’°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ'6Ö'BÖ†–çB#àĞ¢Ç7â6Æ74æÖSÒ&†–çBÖ–6öâ#îhùzK£Â÷7ãàĞ¢ÆF—càĞ¢Ç7G&öæsç·&ö¦V7Bò.‹ùjë^šyºî{¸şXèn‹ùXúşKº^i»NX[~KÙ2"¢.[»®ŠêîŠ^XX^Xúşš¨ÎŠøy¨NKúhò'ÓÂ÷7G&öæsàĞ¢ÇàĞ¢·&ö¦V7@Ğ¢ò.KÚŠz>Xk>K¨nK¸K˜X[~KÙ>™zîš)ûÉşY:®K©¾˜:XˆnyKKÚxºÎz¸¾ZèÎh‰ûÉò Ğ¢¢.KÛşyJK¨nK¸K˜[z^X[~ûÉşi[hÚîŠxNjŠZI®ZJ~ûÉşiÈ{¸Kª~yIşK¨nK¸K˜{¹>iéÎûÉò'ĞĞ¢Â÷àĞ¢ÂöF—càĞ¢Æ'WGFöãîiú^yÈ¾Xik9SÂö'WGFöãàĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâG'WF„æ÷F–6R‚’°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ'G'WF‚Öæ÷F–6R#àĞ¢Ç7ãîy»ãÂ÷7ãàĞ¢ÇãÇ7G&öæsîyÉşZéîKúhşKùŞhªCÂ÷7G&öæsîXiKÙÎhùzK®Xú®Yû®K¨îKÚ[{.Z¾Xiy¨NXh^ZëûÈÎKˆŞKÉ®k{¾XªKˆŞZÙYÊy¨N{¸şXèn8h¨ˆ;Şh‰ni[hÚî8#Â÷àĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ Ğ¦gVæ7F–öâÖöFÂ‡°Ğ¢F—FÆRÀĞ¢öä6Æ÷6RÀĞ¢6†–ÆG&VâÀĞ§Ó¢°Ğ¢F—FÆS¢7G&–æs°Ğ¢öä6Æ÷6S¢‚’Óâfö–C°Ğ¢6†–ÆG&Vã¢&V7Bå&V7DæöFS°Ğ§Ò’°Ğ¢&WGW&â€Ğ¢ÆF—b6Æ74æÖSÒ&ÖöFÂÖ&6¶G&÷"&öÆSÒ'&W6VçFF–öâ"öäÖ÷W6TF÷vã×¶öä6Æ÷6WÓàĞ¢Ç6V7F–öàĞ¢6Æ74æÖSÒ&ÖöFÂ Ğ¢&öÆSÒ&F–Æör Ğ¢&–ÖÖöFÃÒ'G'VR Ğ¢&–ÖÆ&VÃ×·F—FÆWĞĞ¢öäÖ÷W6TF÷vã×²†WfVçB’ÓâWfVçBç7F÷&÷vF–öâ‚—ĞĞ¢àĞ¢Æ†VFW#ãÆƒ#ç·F—FÆWÓÂöƒ#ãÆ'WGFöâöä6Æ–6³×¶öä6Æ÷6WÓì9sÂö'WGFöããÂö†VFW#àĞ¢¶6†–ÆG&VçĞĞ¢Â÷6V7F–öãàĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ