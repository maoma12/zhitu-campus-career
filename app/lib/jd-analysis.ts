export type RequirementKind = "hard" | "soft" | "domain" | "tool";
export type RequirementIntensity = "must" | "preferred" | "mentioned";
export type JobCategory =
  | "前端" | "后端" | "客户端/移动端" | "测试" | "数据分析/数据开发"
  | "算法/AI" | "运维/云/安全" | "产品经理" | "产品运营/增长"
  | "内容运营" | "用户运营" | "活动运营" | "社区运营" | "电商/直播运营"
  | "品牌/市场" | "商务/销售" | "人力资源" | "财务" | "行政/项目协调"
  | "未分类" | "unknown" | "ambiguous";

export type KeywordRule = {
  id?: string;
  label: string;
  aliases: string[];
  category?: JobCategory;
  kind?: RequirementKind;
  question?: string;
  answerStructure?: string;
  categoryWeight?: number;
  contextExclusions?: string[];
};

export type EvidenceLevel = "experience" | "listed";
export type EvidenceSection = { label: string; level: EvidenceLevel; text: string };
export type KeywordEvidence = { keyword: string; level: EvidenceLevel; sources: string[] };
export type RequirementEvidence = {
  id: string;
  label: string;
  kind: RequirementKind;
  category: JobCategory;
  intensity: RequirementIntensity;
  level: EvidenceLevel | "gap";
  sources: string[];
  jdSnippet: string;
  section: JDSection;
  strengthSource: string;
  inferred: boolean;
};
export type JDSection = "responsibilities" | "requirements" | "preferred" | "unsegmented";
export type ExcludedRequirement = {
  id: string;
  label: string;
  disposition: "excluded" | "optional";
  jdSnippet: string;
  section: JDSection;
  reason: string;
  inferred: boolean;
};
export type JDConstraint = {
  id: string;
  label: string;
  jdSnippet: string;
  section: JDSection;
  intensity: RequirementIntensity;
  inferred: boolean;
};
export type JDInputStatus = {
  state: "empty" | "insufficient" | "analyzable" | "title-only";
  label: string;
  detail: string;
  canAnalyze: boolean;
};
export type JDStructure = {
  title: string;
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  unsegmented: string[];
  category: JobCategory;
  categoryConfidence: number;
  categoryEvidence: string[];
};
export type InterviewQuestion = {
  id: string;
  tag: string;
  question: string;
  requirement: string;
  why: string;
  answerStructure: string;
  evidenceSources: string[];
  safetyNote: string;
  supplemental: boolean;
};
export type KeywordCoverageResult = {
  keywords: string[];
  matched: string[];
  missing: string[];
  evidence: KeywordEvidence[];
  coverageRatio: number;
  coverageLabel: "未识别" | "覆盖较低" | "部分覆盖" | "覆盖较高";
  structure?: JDStructure;
  requirements?: RequirementEvidence[];
  excludedRequirements?: ExcludedRequirement[];
  constraints?: JDConstraint[];
  questions?: InterviewQuestion[];
  inputStatus?: JDInputStatus;
};

const rules: KeywordRule[] = [
  { id:"html-css",label:"HTML/CSS",aliases:["html","css"],category:"前端",kind:"hard",question:"请说明你如何实现并验证响应式页面。",answerStructure:"定义目标－实现方案－兼容验证－复盘" },
  { id:"javascript",label:"JavaScript/TypeScript",aliases:["javascript","typescript","js","ts"],category:"前端",kind:"hard",question:"请结合真实项目说明类型与状态管理取舍。",answerStructure:"场景－选择－实现－结果－复盘" },
  { id:"react",label:"React",aliases:["react"],category:"前端",kind:"hard",question:"请说明组件状态变化与渲染之间的关系。" },
  { id:"vue",label:"Vue",aliases:["vue"],category:"前端",kind:"hard",question:"请说明响应式数据更新的基本思路。" },
  { id:"java",label:"Java",aliases:["java"],category:"后端",kind:"hard",question:"请结合真实项目说明面向对象设计。" },
  { id:"spring",label:"Spring Boot",aliases:["spring boot","springboot"],category:"后端",kind:"hard",question:"请说明自动配置的基本原理与使用场景。" },
  { id:"python",label:"Python",aliases:["python"],category:"数据分析/数据开发",kind:"hard",categoryWeight:.5,question:"请说明你用 Python 完成过的真实任务。" },
  { id:"go",label:"Go",aliases:["golang","go language"],category:"后端",kind:"hard" },
  { id:"cpp",label:"C/C++",aliases:["c++","c/c++","c","objective-c"],category:"客户端/移动端",kind:"hard" },
  { id:"android",label:"Android",aliases:["android","kotlin"],category:"客户端/移动端",kind:"hard" },
  { id:"ios",label:"iOS",aliases:["ios","swift"],category:"客户端/移动端",kind:"hard" },
  { id:"sql",label:"SQL",aliases:["sql"],category:"数据分析/数据开发",kind:"hard",question:"请说明你如何验证查询正确性并优化性能。" },
  { id:"r-language",label:"R",aliases:["r language","r语言","r"],category:"数据分析/数据开发",kind:"hard" },
  { id:"mysql",label:"MySQL",aliases:["mysql"],category:"后端",kind:"tool",question:"请说明索引设计与失效场景。" },
  { id:"redis",label:"Redis",aliases:["redis"],category:"后端",kind:"tool" },
  { id:"git",label:"Git",aliases:["git"],category:"前端",kind:"tool",categoryWeight:0 },
  { id:"linux",label:"Linux",aliases:["linux"],category:"运维/云/安全",kind:"tool",categoryWeight:.5 },
  { id:"cloud",label:"云平台",aliases:["云平台","云计算","cloud","cloud platform","aws","腾讯云","阿里云"],category:"运维/云/安全",kind:"tool",categoryWeight:.5 },
  { id:"security",label:"信息安全",aliases:["信息安全","网络安全","安全测试","渗透测试"],category:"运维/云/安全",kind:"domain" },
  { id:"testing",label:"软件测试",aliases:["软件测试","功能测试","自动化测试","测试用例","automation testing","quality assurance","qa","unit test","单元测试"],category:"测试",kind:"hard",categoryWeight:2 },
  { id:"data-analysis",label:"数据分析",aliases:["数据分析","数据洞察","指标分析","data analysis"],category:"数据分析/数据开发",kind:"hard" },
  { id:"data-engineering",label:"数据开发",aliases:["数据开发","数据仓库","etl","spark","hadoop"],category:"数据分析/数据开发",kind:"hard" },
  { id:"ml",label:"机器学习/算法",aliases:["机器学习","深度学习","算法","machine learning","artificial intelligence","ai","pytorch"],category:"算法/AI",kind:"hard",categoryWeight:2 },
  { id:"tensorflow",label:"TensorFlow",aliases:["tensorflow"],category:"算法/AI",kind:"tool" },
  { id:"product",label:"需求分析",aliases:["需求分析","需求文档","prd","prd writing","product requirement document","原型设计","产品设计"],category:"产品经理",kind:"hard",question:"请说明一次真实需求从发现到验收的过程。",answerStructure:"用户问题－判断依据－方案－协同落地－验证" },
  { id:"user-research",label:"用户研究",aliases:["用户研究","用户访谈","可用性测试","用户调研","user research","user interview"],category:"产品经理",kind:"hard" },
  { id:"growth",label:"增长运营",aliases:["增长运营","增长策略","转化率","留存率","增长实验"],category:"产品运营/增长",kind:"domain" },
  { id:"content",label:"内容运营",aliases:["内容运营","内容策划","选题策划","文案撰写","content operations","content planning"],category:"内容运营",kind:"domain" },
  { id:"user-ops",label:"用户运营",aliases:["用户运营","用户分层","用户生命周期","私域运营"],category:"用户运营",kind:"domain" },
  { id:"campaign",label:"活动运营",aliases:["活动运营","活动策划","活动执行","活动复盘"],category:"活动运营",kind:"domain" },
  { id:"community",label:"社区运营",aliases:["社区运营","社群运营","社区治理"],category:"社区运营",kind:"domain" },
  { id:"ecommerce",label:"电商/直播运营",aliases:["电商运营","直播运营","商品运营","gmv"],category:"电商/直播运营",kind:"domain" },
  { id:"brand",label:"品牌/市场",aliases:["品牌营销","品牌传播","市场营销","市场推广","媒介投放","brand marketing","marketing"],category:"品牌/市场",kind:"domain" },
  { id:"sales",label:"商务/销售",aliases:["商务拓展","销售","客户开发","渠道拓展","business development","sales","bd"],category:"商务/销售",kind:"domain" },
  { id:"hr",label:"人力资源",aliases:["人力资源","招聘","员工关系","绩效管理","培训发展","human resources","recruiting","recruitment","hr"],category:"人力资源",kind:"domain",contextExclusions:["相关专业"] },
  { id:"finance",label:"财务",aliases:["财务分析","会计","审计","预算管理","财务报表","financial analysis","finance","accounting","audit"],category:"财务",kind:"domain" },
  { id:"coordination",label:"行政/项目协调",aliases:["行政管理","项目协调","会议组织","流程跟进","project coordination","project coordinator"],category:"行政/项目协调",kind:"domain" },
  { id:"excel",label:"Excel",aliases:["excel","数据透视表","vlookup"],category:"财务",kind:"tool",categoryWeight:0 },
  { id:"communication",label:"沟通协作",aliases:["沟通能力","沟通协作","跨部门协作","跨部门沟通","团队协作","communication","collaboration"],category:"未分类",kind:"soft",categoryWeight:0,question:"请用真实经历说明你如何协调相关方推进任务。",answerStructure:"STAR：情境－任务－行动－结果－复盘" },
  { id:"learning",label:"学习能力",aliases:["学习能力","快速学习","自驱学习"],category:"未分类",kind:"soft",question:"请用真实经历说明你如何学习并应用一项新知识。",answerStructure:"学习目标－方法－应用－验证－复盘" },
  { id:"execution",label:"执行与推进",aliases:["执行力","推动落地","项目推进"],category:"行政/项目协调",kind:"soft" },
];
export const JD_CAPABILITY_RULES = rules;

function normalize(value:string){return value.normalize("NFKC").toLowerCase()}
function aliasPattern(alias:string){
  const escaped=normalize(alias).replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
  return /^[a-z0-9+#./ -]+$/i.test(alias)
    ? new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,"i")
    : new RegExp(escaped,"i");
}
function findAlias(text:string, aliases:string[], exclusions:string[]=[]){
  const normalized=normalize(text);
  if(exclusions.some(pattern=>normalized.includes(normalize(pattern))))return null;
  return aliases.map(alias=>({alias,match:aliasPattern(alias).exec(normalized)})).find(item=>item.match)?.match ?? null;
}

type Strength = { intensity: RequirementIntensity; disposition: "active"|"optional"|"excluded"; source: string };
function strengthFor(snippet:string,section:JDSection):Strength{
  const text=normalize(snippet);
  const excluded=text.match(/无需(?:掌握|具备|熟悉|了解)?|不要求|非必须|不是硬性要求|可无|no\s+(?:\w+\s+){0,3}(?:experience\s+)?required|not\s+required/i);
  if(excluded)return{intensity:"mentioned",disposition:"excluded",source:excluded[0]};
  const optional=text.match(/可选|optional/i);
  if(optional)return{intensity:"mentioned",disposition:"optional",source:optional[0]};
  const preferred=text.match(/优先|加分|preferred|(?:is\s+)?a\s+plus|nice\s+to\s+have/i);
  if(preferred)return{intensity:"preferred",disposition:"active",source:preferred[0]};
  if(section==="preferred")return{intensity:"preferred",disposition:"active",source:"加分/优先分区"};
  if(section==="responsibilities")return{intensity:"mentioned",disposition:"active",source:"职责提及"};
  const must=text.match(/必须|精通|熟练掌握|掌握|具备|能够|required\b|must\b/i);
  if(must)return{intensity:"must",disposition:"active",source:must[0]};
  const mentioned=text.match(/熟悉|了解|familiar|knowledge\s+of/i);
  return{intensity:"mentioned",disposition:"active",source:mentioned?.[0]??(section==="unsegmented"?"未分段文字":"任职要求提及")};
}

function cleanLine(value:string){return value.replace(/^\s*(?:[-*•·▪◦]|\d+[.、)])\s*/,"").trim()}
function splitClauses(value:string){
  return value.split(/(?:\r?\n|[；;。]|\.(?=\s|$))/).map(cleanLine).filter(Boolean);
}

const headingPatterns:{section:JDSection|"ignore";pattern:RegExp}[]=[
  {section:"responsibilities",pattern:/(岗位职责|工作职责|职位职责|职责描述|工作内容|主要职责|responsibilities?|what you(?:'|’)ll do)[:：]?/gi},
  {section:"preferred",pattern:/(加分项|优先条件|优先考虑|preferred qualifications?|nice to have|bonus)[:：]?/gi},
  {section:"requirements",pattern:/(任职要求|岗位要求|职位要求|资格要求|基本要求|任职资格|我们希望|requirements?|qualifications?|what we(?:'|’)re looking for)[:：]?/gi},
  {section:"ignore",pattern:/(福利待遇|薪资福利|你将获得|benefits?|compensation)[:：]?/gi},
];

const titleCategories:[RegExp,JobCategory][]=[
  [/(前端|frontend|front-end)/i,"前端"],[/(后端|服务端|backend|back-end)/i,"后端"],
  [/(移动端|客户端|android|ios|mobile app)/i,"客户端/移动端"],[/(测试|qa\b|quality assurance)/i,"测试"],
  [/(数据分析|数据开发|data analyst|data engineer)/i,"数据分析/数据开发"],[/(算法|machine learning|\bai\b)/i,"算法/AI"],
  [/(运维|云安全|cloud operations|devops|security)/i,"运维/云/安全"],[/(产品经理|product manager)/i,"产品经理"],
  [/(产品运营|增长运营|growth operations)/i,"产品运营/增长"],[/(内容运营|content operations)/i,"内容运营"],
  [/(用户运营|user operations)/i,"用户运营"],[/(活动运营|campaign operations)/i,"活动运营"],
  [/(社区运营|社群运营|community operations)/i,"社区运营"],[/(电商运营|直播运营|e-commerce operations)/i,"电商/直播运营"],
  [/(品牌|市场|brand marketing|marketing intern)/i,"品牌/市场"],[/(商务|销售|business development|sales)/i,"商务/销售"],
  [/(人力|招聘|human resources|\bhr\b)/i,"人力资源"],[/(财务|会计|审计|finance|accounting)/i,"财务"],
  [/(行政|项目协调|project coordinator)/i,"行政/项目协调"],
];
function titleCategory(value:string){return titleCategories.find(([pattern])=>pattern.test(value))?.[1]}

export function parseJDStructure(jd:string):JDStructure{
  let marked=jd.replace(/\r/g,"");
  headingPatterns.forEach(({section,pattern})=>{marked=marked.replace(pattern,match=>`\n@@${section}@@${match}\n`)});
  const raw=marked.split(/\n/).map(cleanLine).filter(Boolean);
  const responsibilities:string[]=[];const requirements:string[]=[];const preferred:string[]=[];const unsegmented:string[]=[];
  let mode:JDSection|"ignore"="unsegmented";let title="";
  const candidates=jd.split(/\r?\n/).map(cleanLine).filter(Boolean).slice(0,4);
  title=candidates.find(line=>line.length<=80&&!/(任职要求|岗位要求|requirements?)/i.test(line)&&Boolean(titleCategory(line)))
    ??candidates.find(line=>line.length<=80&&!/[。；;]/.test(line)&&!/^test fixture(?:[｜|]|\s+无标题)/i.test(line))
    ??"";
  raw.forEach(token=>{
    const marker=token.match(/^@@(responsibilities|requirements|preferred|unsegmented|ignore)@@/);
    if(marker){mode=marker[1] as JDSection|"ignore";token=token.replace(/^@@[^@]+@@/,"").replace(/^[^:：]+[:：]?/,"").trim();if(!token)return}
    if(token===title||/^test fixture[｜|]/i.test(token))return;
    if(mode==="ignore")return;
    const target=mode==="responsibilities"?responsibilities:mode==="requirements"?requirements:mode==="preferred"?preferred:unsegmented;
    target.push(...splitClauses(token));
  });
  const byTitle=titleCategory(title);
  if(byTitle)return{title,responsibilities,requirements,preferred,unsegmented,category:byTitle,categoryConfidence:.95,categoryEvidence:[`标题：${title}`]};
  const counts=new Map<JobCategory,{score:number;evidence:string[]}>();
  [...responsibilities,...requirements,...preferred,...unsegmented].forEach(clause=>{
    if(strengthFor(clause,"unsegmented").disposition!=="active")return;
    rules.forEach(rule=>{
      if(!rule.category||rule.category==="未分类"||rule.category==="unknown"||rule.category==="ambiguous"||!findAlias(clause,rule.aliases,rule.contextExclusions))return;
      const weight=rule.categoryWeight??(rule.kind==="tool"?.25:rule.kind==="soft"?.1:1);
      const old=counts.get(rule.category)??{score:0,evidence:[]};old.score+=weight;old.evidence.push(rule.label);counts.set(rule.category,old);
    });
  });
  const ranked=[...counts.entries()].sort((a,b)=>b[1].score-a[1].score||a[0].localeCompare(b[0]));
  if(!ranked.length||ranked[0][1].score<.75)return{title,responsibilities,requirements,preferred,unsegmented,category:"unknown",categoryConfidence:0,categoryEvidence:[]};
  if(ranked[1]&&ranked[1][1].score>=.75&&ranked[0][1].score-ranked[1][1].score<.35)return{title,responsibilities,requirements,preferred,unsegmented,category:"ambiguous",categoryConfidence:.45,categoryEvidence:[...new Set([...ranked[0][1].evidence,...ranked[1][1].evidence])]};
  const top=ranked[0];return{title,responsibilities,requirements,preferred,unsegmented,category:top[0],categoryConfidence:Math.min(.8,.5+top[1].score*.1),categoryEvidence:[...new Set(top[1].evidence)]};
}

export function assessJDInput(jd:string):JDInputStatus{
  const text=jd.trim(); if(!text)return{state:"empty",label:"尚未填写",detail:"请粘贴岗位标题、职责或任职要求。",canAnalyze:false};
  const structure=parseJDStructure(text); const recognized=rules.some(r=>findAlias(text,r.aliases));
  if(structure.title&&!structure.responsibilities.length&&!structure.requirements.length&&!structure.unsegmented.length)return{state:"title-only",label:"仅识别到标题",detail:"请补充职责或任职要求后再分析。",canAnalyze:false};
  if(recognized||structure.requirements.length||structure.preferred.length||structure.responsibilities.length)return{state:"analyzable",label:structure.requirements.length?"可分析":"可分析，但任职要求未明确分段",detail:structure.requirements.length?"将按当前文字提取要求。":"补充任职要求可获得更完整结果。",canAnalyze:true};
  return{state:"insufficient",label:"信息较少",detail:"仍可分析原文，但可能没有预设能力命中。",canAnalyze:true};
}

function requirementsFrom(structure:JDStructure,customRules:KeywordRule[]=rules){
  const pools:[string[],JDSection][]=[[structure.responsibilities,"responsibilities"],[structure.requirements,"requirements"],[structure.preferred,"preferred"],[structure.unsegmented,"unsegmented"]];
  const found=new Map<string,Omit<RequirementEvidence,"level"|"sources">>();const excluded=new Map<string,ExcludedRequirement>();
  const rank={must:3,preferred:2,mentioned:1};const sectionRank:Record<JDSection,number>={requirements:4,preferred:3,unsegmented:2,responsibilities:1};
  pools.forEach(([items,section])=>items.forEach(clause=>customRules.forEach(rule=>{
    if(!findAlias(clause,rule.aliases,rule.contextExclusions))return;const id=rule.id??rule.label;const strength=strengthFor(clause,section);const inferred=section==="unsegmented";
    if(strength.disposition!=="active"){excluded.set(id,{id,label:rule.label,disposition:strength.disposition,jdSnippet:clause.slice(0,180),section,reason:strength.source,inferred});return}
    const next={id,label:rule.label,kind:rule.kind??"hard",category:rule.category??"未分类",intensity:strength.intensity,jdSnippet:clause.slice(0,180),section,strengthSource:strength.source,inferred};
    const old=found.get(id);if(!old||rank[next.intensity]>rank[old.intensity]||(rank[next.intensity]===rank[old.intensity]&&sectionRank[next.section]>sectionRank[old.section]))found.set(id,next);
  })));
  return{requirements:[...found.values()],excluded:[...excluded.values()].filter(item=>!found.has(item.id))};
}

const constraintRules:{id:string;label:string;pattern:RegExp}[]=[
  {id:"education",label:"学历要求",pattern:/(本科|硕士|博士|大专|学历)/i},{id:"major",label:"专业要求",pattern:/(相关专业|计算机专业|统计学|人力资源专业)/i},
  {id:"experience",label:"经验/年限要求",pattern:/(\d+\s*年.*经验|experience)/i},{id:"internship",label:"实习时长/到岗要求",pattern:/(实习.*(?:天|月)|每周.*天|到岗)/i},
  {id:"graduation",label:"毕业年份",pattern:/(20\d{2}\s*年?毕业)/i},{id:"language",label:"语言要求",pattern:/(英语|六级|四级|cet-?[46]|雅思|托福)/i},
  {id:"certificate",label:"证书要求",pattern:/(证书|会计证|资格证)/i},{id:"portfolio",label:"作品集要求",pattern:/(作品集|portfolio)/i},{id:"travel",label:"出差要求",pattern:/(出差|travel)/i},
];
function constraintsFrom(structure:JDStructure):JDConstraint[]{
  const pools:[string[],JDSection][]=[[structure.requirements,"requirements"],[structure.preferred,"preferred"],[structure.unsegmented,"unsegmented"]];const result:JDConstraint[]=[];
  pools.forEach(([items,section])=>items.forEach(clause=>constraintRules.forEach(rule=>{if(!rule.pattern.test(clause)||result.some(item=>item.id===rule.id&&item.jdSnippet===clause))return;const strength=strengthFor(clause,section);if(strength.disposition==="excluded")return;result.push({id:rule.id,label:rule.label,jdSnippet:clause.slice(0,180),section,intensity:strength.intensity,inferred:section==="unsegmented"})})));
  return result;
}

function hasSoftExperience(text:string,aliases:string[]){return Boolean(findAlias(text,aliases)&&/(负责|协同|协调|推动|组织|沟通并|解决|复盘|主持|跟进|完成)/.test(text))}

export function analyzeJD(jd:string,sections:EvidenceSection[],customRules:KeywordRule[]=rules):KeywordCoverageResult{
  const structure=parseJDStructure(jd); const parsed=requirementsFrom(structure,customRules);const selected=parsed.requirements;
  const requirementEvidence:RequirementEvidence[]=selected.map(req=>{
    const rule=customRules.find(r=>(r.id??r.label)===req.id||r.label===req.label)!;
    const matches=sections.filter(s=>req.kind==="soft"&&s.level==="experience"?hasSoftExperience(s.text,rule.aliases):Boolean(findAlias(s.text,rule.aliases)));
    const experienced=matches.filter(s=>s.level==="experience"); const strongest=experienced.length?experienced:matches;
    return{...req,level:experienced.length?"experience":matches.length?"listed":"gap",sources:[...new Set(strongest.map(s=>s.label))]};
  });
  const evidence=requirementEvidence.filter(x=>x.level!=="gap").map(x=>({keyword:x.label,level:x.level as EvidenceLevel,sources:x.sources}));
  const matched=evidence.map(x=>x.keyword); const missing=requirementEvidence.filter(x=>x.level==="gap").map(x=>x.label); const ratio=selected.length?matched.length/selected.length:0;
  return{keywords:selected.map(x=>x.label),matched,missing,evidence,coverageRatio:ratio,coverageLabel:!selected.length?"未识别":ratio>=.7?"覆盖较高":ratio>=.4?"部分覆盖":"覆盖较低",structure,requirements:requirementEvidence,excludedRequirements:parsed.excluded,constraints:constraintsFrom(structure),inputStatus:assessJDInput(jd),questions:buildInterviewQuestions(requirementEvidence)};
}

export function analyzeKeywordCoverage(jd:string,customRules:KeywordRule[],sections:EvidenceSection[]):KeywordCoverageResult{
  const structure=parseJDStructure(jd); const selected=customRules.filter(rule=>findAlias(jd,rule.aliases));
  const evidence=selected.flatMap<KeywordEvidence>(rule=>{const matches=sections.filter(s=>findAlias(s.text,rule.aliases));const exp=matches.filter(s=>s.level==="experience");const strongest=exp.length?exp:matches;return strongest.length?[{keyword:rule.label,level:exp.length?"experience":"listed",sources:[...new Set(strongest.map(s=>s.label))]}]:[]});
  const matched=evidence.map(x=>x.keyword);const missing=selected.map(x=>x.label).filter(x=>!matched.includes(x));const ratio=selected.length?matched.length/selected.length:0;
  return{keywords:selected.map(x=>x.label),matched,missing,evidence,coverageRatio:ratio,coverageLabel:!selected.length?"未识别":ratio>=.7?"覆盖较高":ratio>=.4?"部分覆盖":"覆盖较低",structure,inputStatus:assessJDInput(jd)};
}

export function buildInterviewQuestions(requirements:RequirementEvidence[],limit=8):InterviewQuestion[]{
  const rank=(x:RequirementEvidence)=>(x.intensity==="must"?0:x.intensity==="preferred"?2:4)+(x.level==="gap"?0:x.level==="experience"?1:2);
  const result:InterviewQuestion[]=[];
  [...requirements].sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id)).forEach(req=>{
    if(result.length>=limit)return;const rule=rules.find(r=>(r.id??r.label)===req.id);const question=rule?.question??`请结合真实经历说明你对「${req.label}」的理解与应用。`;
    if(result.some(x=>x.question===question))return;
    result.push({id:req.id,tag:`${req.intensity==="must"?"必须":req.intensity==="preferred"?"加分":"提及"} · ${req.level==="gap"?"待确认":req.level==="experience"?"经历证据":"仅陈述"}`,question,requirement:req.label,why:`JD 原文提到「${req.jdSnippet}」`,answerStructure:rule?.answerStructure??(req.kind==="soft"?"STAR：情境－任务－行动－结果－复盘":"定义－原理－场景－验证－复盘"),evidenceSources:req.sources,safetyNote:req.sources.length?`只引用简历中的${req.sources.join("、")}。`:"简历暂无文字证据，只能基于你的真实经历手动准备，不能编造答案。",supplemental:false});
  });
  const supplements=[
    ["general-project","请选择一段真实经历，说明目标、个人行动、结果和复盘。","STAR：情境－任务－行动－结果－复盘"],
    ["general-role","请说明你在一段真实经历中的个人边界与贡献。","背景－个人职责－行动－结果－复盘"],
    ["general-choice","请说明一次真实方案选择：备选方案、判断依据和验证方式。","问题－选项－依据－验证－复盘"],
    ["general-failure","请说明一次真实困难或未达预期的经历及改进。","情境－问题－行动－结果－改进"],
    ["general-learning","请说明你如何学习并在真实任务中验证新知识。","目标－方法－应用－验证－复盘"],
  ] as const;
  for(const [id,question,answerStructure] of supplements){if(result.length>=5||result.length>=limit)break;result.push({id,tag:"通用补充",question,requirement:"通用校招准备",why:"当前 JD 可识别的具体要求不足 5 项。",answerStructure,evidenceSources:[],safetyNote:"只使用你本人真实经历；不要补写不存在的数据。",supplemental:true})}
  return result.slice(0,Math.max(5,Math.min(8,limit)));
}

export type JobComparisonItem={id:string;name:string;analysis:KeywordCoverageResult};
export function compareJobTargets(items:JobComparisonItem[]){
  const chosen=items.slice(0,3);const sets=chosen.map(x=>new Set(x.analysis.requirements?.map(r=>r.label)??x.analysis.keywords));
  const common=sets.length?[...sets[0]].filter(x=>sets.every(s=>s.has(x))):[];
  return{common,items:chosen.map((item,index)=>{const req=item.analysis.requirements??[];return{id:item.id,name:item.name,recognized:req.length||item.analysis.keywords.length,experience:req.filter(x=>x.level==="experience").length||item.analysis.evidence.filter(x=>x.level==="experience").length,listed:req.filter(x=>x.level==="listed").length||item.analysis.evidence.filter(x=>x.level==="listed").length,gap:req.filter(x=>x.level==="gap").length||item.analysis.missing.length,unique:[...sets[index]].filter(x=>!sets.some((s,i)=>i!==index&&s.has(x))),category:item.analysis.structure?.category??"未分类",intensity:{must:req.filter(x=>x.intensity==="must").length,preferred:req.filter(x=>x.intensity==="preferred").length,mentioned:req.filter(x=>x.intensity==="mentioned").length}}})};
}

export function summarizeJDForFixture(jd:string){
  const analysis=analyzeJD(jd,[]);
  return{title:analysis.structure?.title??"",category:analysis.structure?.category??"未分类",requirements:analysis.requirements?.map(x=>({label:x.label,kind:x.kind,intensity:x.intensity}))??[]};
}
