// TEST FIXTURE ONLY: every company, role, résumé fact, date and number below is synthetic.
import type {
  EvidenceLevel,
  EvidenceSection,
  JobCategory,
  RequirementIntensity,
  RequirementKind,
} from "../../app/lib/jd-analysis.ts";

export type GoldRequirement = {
  id: string;
  kind: RequirementKind;
  intensity: RequirementIntensity;
  section: "responsibilities" | "requirements" | "unsegmented";
};

export type JDEvaluationFixture = {
  id: string;
  family: string;
  format: "boss" | "bullets" | "english" | "single-line";
  jd: string;
  gold: {
    category: JobCategory | "unknown" | "ambiguous";
    requirements: GoldRequirement[];
    excluded: string[];
    constraints: string[];
    evidence: Record<string, EvidenceLevel | "gap">;
  };
};

export const EVALUATION_RESUME: EvidenceSection[] = [
  { label: "TEST FIXTURE 项目 A", level: "experience", text: "使用 React 完成虚构页面，并通过测试用例验证。" },
  { label: "TEST FIXTURE 项目 B", level: "experience", text: "使用 Java 与 MySQL 完成虚构接口。" },
  { label: "TEST FIXTURE 校园经历", level: "experience", text: "负责跨部门协作，协调成员并复盘虚构结果。" },
  { label: "TEST FIXTURE 技能", level: "listed", text: "TypeScript、Python、SQL、Excel、沟通能力、Linux" },
];

type Family = {
  id: string;
  category: JobCategory;
  title: string;
  responsibility: string;
  requirementA: { id: string; text: string; kind: RequirementKind; intensity: RequirementIntensity; evidence: EvidenceLevel | "gap" };
  requirementB: { id: string; text: string; kind: RequirementKind; intensity: RequirementIntensity; evidence: EvidenceLevel | "gap" };
  excluded: { id: string; text: string };
  constraint: string;
  english?: { title: string; responsibility: string; requirementA: string; requirementB: string; excluded: string };
  englishIntensityB?: RequirementIntensity;
};

const families: Family[] = [
  { id:"frontend",category:"前端",title:"前端开发实习生",responsibility:"负责响应式页面开发",requirementA:{id:"react",text:"熟练掌握 React",kind:"hard",intensity:"must",evidence:"experience"},requirementB:{id:"javascript",text:"熟悉 TypeScript",kind:"hard",intensity:"mentioned",evidence:"listed"},excluded:{id:"vue",text:"无需掌握 Vue"},constraint:"本科及以上学历",english:{title:"Frontend Intern",responsibility:"Build accessible web pages",requirementA:"React is required",requirementB:"TypeScript preferred",excluded:"Vue is not required"}},
  { id:"backend",category:"后端",title:"后端开发实习生",responsibility:"负责虚构服务接口开发",requirementA:{id:"java",text:"必须掌握 Java",kind:"hard",intensity:"must",evidence:"experience"},requirementB:{id:"mysql",text:"熟悉 MySQL",kind:"tool",intensity:"mentioned",evidence:"experience"},excluded:{id:"redis",text:"Redis 非必须"},constraint:"每周实习至少 4 天",english:{title:"Backend Intern",responsibility:"Develop test service APIs",requirementA:"Java required",requirementB:"MySQL preferred",excluded:"Redis optional"}},
  { id:"mobile",category:"客户端/移动端",title:"移动端开发实习生",responsibility:"负责虚构客户端功能",requirementA:{id:"android",text:"掌握 Android 与 Kotlin",kind:"hard",intensity:"must",evidence:"gap"},requirementB:{id:"git",text:"了解 Git",kind:"tool",intensity:"mentioned",evidence:"gap"},excluded:{id:"ios",text:"不要求 iOS 经验"},constraint:"2027 年毕业",english:{title:"Mobile App Intern",responsibility:"Build Android features",requirementA:"Android required",requirementB:"Git is a plus",excluded:"iOS experience not required"}},
  { id:"testing",category:"测试",title:"软件测试实习生",responsibility:"设计虚构测试方案",requirementA:{id:"testing",text:"熟练掌握自动化测试",kind:"hard",intensity:"must",evidence:"experience"},requirementB:{id:"sql",text:"了解 SQL",kind:"hard",intensity:"mentioned",evidence:"listed"},excluded:{id:"java",text:"无需掌握 Java"},constraint:"可连续实习 3 个月",english:{title:"QA Intern",responsibility:"Design synthetic test cases",requirementA:"Automation testing required",requirementB:"SQL preferred",excluded:"Java not required"}},
  { id:"data",category:"数据分析/数据开发",title:"数据分析实习生",responsibility:"负责虚构指标分析",requirementA:{id:"data-analysis",text:"掌握数据分析",kind:"hard",intensity:"must",evidence:"gap"},requirementB:{id:"sql",text:"熟悉 SQL",kind:"hard",intensity:"mentioned",evidence:"listed"},excluded:{id:"data-engineering",text:"无需 Spark 经验"},constraint:"统计学相关专业优先",english:{title:"Data Analyst Intern",responsibility:"Analyze synthetic metrics",requirementA:"Data analysis required",requirementB:"SQL required",excluded:"Spark experience not required"},englishIntensityB:"must"},
  { id:"ai",category:"算法/AI",title:"算法实习生",responsibility:"参与虚构模型评估",requirementA:{id:"ml",text:"掌握机器学习与 PyTorch",kind:"hard",intensity:"must",evidence:"gap"},requirementB:{id:"python",text:"熟练掌握 Python",kind:"hard",intensity:"must",evidence:"listed"},excluded:{id:"tensorflow",text:"TensorFlow 可选"},constraint:"硕士学历优先",english:{title:"Machine Learning Intern",responsibility:"Evaluate synthetic models",requirementA:"Machine learning required",requirementB:"Python required",excluded:"TensorFlow optional"},englishIntensityB:"must"},
  { id:"cloud",category:"运维/云/安全",title:"云运维实习生",responsibility:"维护虚构云环境",requirementA:{id:"linux",text:"必须熟悉 Linux",kind:"tool",intensity:"must",evidence:"listed"},requirementB:{id:"cloud",text:"了解云平台",kind:"tool",intensity:"mentioned",evidence:"gap"},excluded:{id:"security",text:"不要求渗透测试"},constraint:"能接受短期出差",english:{title:"Cloud Operations Intern",responsibility:"Maintain a synthetic cloud",requirementA:"Linux required",requirementB:"Cloud knowledge preferred",excluded:"Penetration testing not required"}},
  { id:"product",category:"产品经理",title:"产品经理实习生",responsibility:"负责虚构需求调研",requirementA:{id:"product",text:"具备需求分析和 PRD 能力",kind:"hard",intensity:"must",evidence:"gap"},requirementB:{id:"user-research",text:"熟悉用户调研",kind:"hard",intensity:"mentioned",evidence:"gap"},excluded:{id:"sql",text:"无需掌握 SQL"},constraint:"需提供作品集",english:{title:"Product Manager Intern",responsibility:"Research synthetic user needs",requirementA:"PRD writing required",requirementB:"User research preferred",excluded:"SQL not required"}},
  { id:"operations",category:"内容运营",title:"内容运营实习生",responsibility:"策划虚构内容栏目",requirementA:{id:"content",text:"具备内容策划能力",kind:"domain",intensity:"must",evidence:"gap"},requirementB:{id:"communication",text:"熟悉跨部门协作",kind:"soft",intensity:"mentioned",evidence:"experience"},excluded:{id:"excel",text:"Excel 不是硬性要求"},constraint:"每周到岗 4 天",english:{title:"Content Operations Intern",responsibility:"Plan synthetic content",requirementA:"Content planning required",requirementB:"Communication preferred",excluded:"Excel not required"}},
  { id:"market",category:"品牌/市场",title:"品牌市场实习生",responsibility:"协助虚构品牌传播",requirementA:{id:"brand",text:"掌握市场推广",kind:"domain",intensity:"must",evidence:"gap"},requirementB:{id:"communication",text:"具备沟通协作能力",kind:"soft",intensity:"must",evidence:"experience"},excluded:{id:"sales",text:"无需销售经验"},constraint:"英语六级优先",english:{title:"Brand Marketing Intern",responsibility:"Support synthetic campaigns",requirementA:"Marketing required",requirementB:"Communication preferred",excluded:"Sales experience not required"}},
  { id:"hr",category:"人力资源",title:"人力资源实习生",responsibility:"协助虚构招聘流程",requirementA:{id:"hr",text:"熟悉招聘流程",kind:"domain",intensity:"mentioned",evidence:"gap"},requirementB:{id:"excel",text:"熟悉 Excel",kind:"tool",intensity:"mentioned",evidence:"listed"},excluded:{id:"python",text:"无需掌握 Python"},constraint:"人力资源相关专业优先",english:{title:"HR Intern",responsibility:"Support synthetic recruiting",requirementA:"Recruiting knowledge required",requirementB:"Excel preferred",excluded:"Python not required"}},
  { id:"finance",category:"财务",title:"财务实习生",responsibility:"整理虚构财务报表",requirementA:{id:"finance",text:"掌握财务分析",kind:"domain",intensity:"must",evidence:"gap"},requirementB:{id:"excel",text:"熟练掌握 Excel",kind:"tool",intensity:"must",evidence:"listed"},excluded:{id:"python",text:"Python 可无"},constraint:"持有初级会计证优先",english:{title:"Finance Intern",responsibility:"Prepare synthetic reports",requirementA:"Financial analysis required",requirementB:"Excel required",excluded:"Python optional"},englishIntensityB:"must"},
  { id:"admin",category:"行政/项目协调",title:"项目协调实习生",responsibility:"跟进虚构项目流程",requirementA:{id:"coordination",text:"具备项目协调能力",kind:"domain",intensity:"must",evidence:"gap"},requirementB:{id:"communication",text:"能够跨部门沟通",kind:"soft",intensity:"must",evidence:"experience"},excluded:{id:"git",text:"Git 非必须"},constraint:"可接受偶尔出差",english:{title:"Project Coordinator Intern",responsibility:"Track synthetic projects",requirementA:"Project coordination required",requirementB:"Communication preferred",excluded:"Git not required"}},
];

const requirement = (family: Family, which: "A" | "B", intensity: RequirementIntensity | undefined, section: GoldRequirement["section"]): GoldRequirement => {
  const item = which === "A" ? family.requirementA : family.requirementB;
  return { id: item.id, kind: item.kind, intensity: intensity ?? item.intensity, section };
};

const generatedFixtures: JDEvaluationFixture[] = families.flatMap((family, index) => {
  const english = family.english!;
  const evidence = { [family.requirementA.id]: family.requirementA.evidence, [family.requirementB.id]: family.requirementB.evidence };
  return [
    {
      id:`${family.id}-normal`,family:family.id,format:"bullets" as const,
      jd:`TEST FIXTURE｜虚构公司\n${family.title}\n岗位职责：\n- ${family.responsibility}\n任职要求：\n- ${family.requirementA.text}\n- ${family.requirementB.text}\n- ${family.constraint}\n- ${family.excluded.text}`,
      gold:{category:family.category,requirements:[requirement(family,"A",undefined,"requirements"),requirement(family,"B",undefined,"requirements")],excluded:[family.excluded.id],constraints:[family.constraint],evidence},
    },
    {
      id:`${family.id}-boss`,family:family.id,format:"boss" as const,
      jd:`${family.title}｜TEST FIXTURE\n职责描述：${family.responsibility}；岗位要求：${family.requirementA.text}；${family.requirementB.text}；${family.excluded.text}\n薪资 100-200 元/天｜虚构市｜https://example.com/test-fixture-${index}`,
      gold:{category:family.category,requirements:[requirement(family,"A",undefined,"requirements"),requirement(family,"B",undefined,"requirements")],excluded:[family.excluded.id],constraints:[],evidence},
    },
    {
      id:`${family.id}-english`,family:family.id,format:"english" as const,
      jd:`${english.title} — TEST FIXTURE\nResponsibilities\n• ${english.responsibility}\nRequirements\n• ${english.requirementA}\n• ${english.requirementB}\n• ${english.excluded}`,
      gold:{category:family.category,requirements:[requirement(family,"A","must","requirements"),requirement(family,"B",family.englishIntensityB??"preferred","requirements")],excluded:[family.excluded.id],constraints:[],evidence},
    },
    {
      id:`${family.id}-compressed`,family:family.id,format:"single-line" as const,
      jd:`TEST FIXTURE 无标题 任职要求：${family.requirementA.text}。${family.requirementB.text}。${family.excluded.text}。福利：虚构餐补、虚构团建。`,
      gold:{category:family.category,requirements:[requirement(family,"A",undefined,"requirements"),requirement(family,"B",undefined,"requirements")],excluded:[family.excluded.id],constraints:[],evidence},
    },
  ];
});

export const JD_EVALUATION_FIXTURES: JDEvaluationFixture[] = [
  ...generatedFixtures,
  { id:"edge-go-noise",family:"edge",format:"english",jd:"TEST FIXTURE English Copy Intern\nResponsibilities: We go to market and train people.\nBenefits: https://example.com/training",gold:{category:"unknown",requirements:[],excluded:[],constraints:[],evidence:{}} },
  { id:"edge-ambiguous-stack",family:"edge",format:"single-line",jd:"TEST FIXTURE 工程实习生 任职要求：必须掌握 React。必须掌握 Java。",gold:{category:"ambiguous",requirements:[{id:"react",kind:"hard",intensity:"must",section:"requirements"},{id:"java",kind:"hard",intensity:"must",section:"requirements"}],excluded:[],constraints:[],evidence:{react:"experience",java:"experience"}} },
  { id:"edge-responsibility-mention",family:"edge",format:"boss",jd:"TEST FIXTURE 前端实习生\n工作内容：使用 React 开发虚构页面\n福利待遇：虚构餐补",gold:{category:"前端",requirements:[{id:"react",kind:"hard",intensity:"mentioned",section:"responsibilities"}],excluded:[],constraints:[],evidence:{react:"experience"}} },
  { id:"edge-negative-only",family:"edge",format:"bullets",jd:"TEST FIXTURE 后端实习生\n任职要求：\n- Java not required\n- Redis optional\n- 无需掌握 MySQL",gold:{category:"后端",requirements:[],excluded:["java","redis","mysql"],constraints:[],evidence:{}} },
  { id:"edge-short-boundaries",family:"edge",format:"single-line",jd:"TEST FIXTURE 数据工程实习生 任职要求：熟悉 C++。了解 R。掌握 SQL。",gold:{category:"数据分析/数据开发",requirements:[{id:"cpp",kind:"hard",intensity:"mentioned",section:"requirements"},{id:"r-language",kind:"hard",intensity:"mentioned",section:"requirements"},{id:"sql",kind:"hard",intensity:"must",section:"requirements"}],excluded:[],constraints:[],evidence:{cpp:"gap","r-language":"gap",sql:"listed"}} },
  { id:"edge-constraints-only",family:"edge",format:"bullets",jd:"TEST FIXTURE 项目助理\n任职要求：本科及以上学历；2027 年毕业；每周实习 4 天；英语六级；提供作品集；接受短期出差",gold:{category:"unknown",requirements:[],excluded:[],constraints:["本科及以上学历","2027 年毕业","每周实习 4 天","英语六级","提供作品集","接受短期出差"],evidence:{}} },
  { id:"edge-url-ai-noise",family:"edge",format:"boss",jd:"TEST FIXTURE 助理实习生\n协助整理资料\nhttps://example.com/paid-training",gold:{category:"unknown",requirements:[],excluded:[],constraints:[],evidence:{}} },
  { id:"edge-sql-boundary",family:"edge",format:"english",jd:"TEST FIXTURE Backend Intern\nRequirements\nMySQL preferred\nSQL knowledge",gold:{category:"后端",requirements:[{id:"mysql",kind:"tool",intensity:"preferred",section:"requirements"},{id:"sql",kind:"hard",intensity:"mentioned",section:"requirements"}],excluded:[],constraints:[],evidence:{mysql:"experience",sql:"listed"}} },
];
