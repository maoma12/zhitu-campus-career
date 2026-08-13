export type RequirementKind = "hard" | "soft" | "domain" | "tool";
export type RequirementIntensity = "must" | "preferred" | "mentioned";
export type JobCategory =
  | "前端" | "后端" | "客户端/移动端" | "测试" | "数据分析/数据开发"
  | "算法/AI" | "运维/云/安全" | "产品经理" | "产品运营/增长"
  | "内容运营" | "用户运营" | "活动运营" | "社区运营" | "电商/直播运营"
  | "品牌/市场" | "商务/销售" | "人力资源" | "财务" | "行政/项目协调" | "未分类";

export type KeywordRule = {
  id?: string;
  label: string;
  aliases: string[];
  category?: JobCategory;
  kind?: RequirementKind;
  question?: string;
  answerStructure?: string;
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
  section: "responsibilities" | "requirements" | "unsegmented";
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
  unsegmented: string[];
  category: JobCategory;
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
  { id:"python",label:"Python",aliases:["python"],category:"数据分析/数据开发",kind:"hard",question:"请说明你用 Python 完成过的真实任务。" },
  { id:"go",label:"Go",aliases:["golang","go language"],category:"后端",kind:"hard" },
  { id:"cpp",label:"C/C++",aliases:["c++","c/c++","objective-c"],category:"客户端/移动端",kind:"hard" },
  { id:"android",label:"Android",aliases:["android","kotlin"],category:"客户端/移动端",kind:"hard" },
  { id:"ios",label:"iOS",aliases:["ios","swift"],category:"客户端/移动端",kind:"hard" },
  { id:"sql",label:"SQL",aliases:["sql"],category:"数据分析/数据开发",kind:"hard",question:"请说明你如何验证查询正确性并优化性能。" },
  { id:"mysql",label:"MySQL",aliases:["mysql"],category:"后端",kind:"tool",question:"请说明索引设计与失效场景。" },
  { id:"redis",label:"Redis",aliases:["redis"],category:"后端",kind:"tool" },
  { id:"git",label:"Git",aliases:["git"],category:"前端",kind:"tool" },
  { id:"linux",label:"Linux",aliases:["linux"],category:"运维/云/安全",kind:"tool" },
  { id:"cloud",label:"云平台",aliases:["云平台","云计算","cloud","aws","腾讯云","阿里云"],category:"运维/云/安全",kind:"tool" },
  { id:"security",label:"信息安全",aliases:["信息安全","网络安全","安全测试","渗透测试"],category:"运维/云/安全",kind:"domain" },
  { id:"testing",label:"软件测试",aliases:["软件测试","功能测试","自动化测试","测试用例","unit test","单元测试"],category:"测试",kind:"hard" },
  { id:"data-analysis",label:"数据分析",aliases:["数据分析","数据洞察","指标分析","data analysis"],category:"数据分析/数据开发",kind:"hard" },
  { id:"data-engineering",label:"数据开发",aliases:["数据开发","数据仓库","etl","spark","hadoop"],category:"数据分析/数据开发",kind:"hard" },
  { id:"ml",label:"机器学习/算法",aliases:["机器学习","深度学习","算法","machine learning","pytorch","tensorflow"],category:"算法/AI",kind:"hard" },
  { id:"product",label:"需求分析",aliases:["需求分析","需求文档","prd","原型设计","产品设计"],category:"产品经理",kind:"hard",question:"请说明一次真实需求从发现到验收的过程。",answerStructure:"用户问题－判断依据－方案－协同落地－验证" },
  { id:"user-research",label:"用户研究",aliases:["用户研究","用户访谈","可用性测试","用户调研"],category:"产品经理",kind:"hard" },
  { id:"growth",label:"增长运营",aliases:["增长运营","增长策略","转化率","留存率","增长实验"],category:"产品运营/增长",kind:"domain" },
  { id:"content",label:"内容运营",aliases:["内容运营","内容策划","选题策划","文案撰写"],category:"内容运营",kind:"domain" },
  { id:"user-ops",label:"用户运营",aliases:["用户运营","用户分层","用户生命周期","私域运营"],category:"用户运营",kind:"domain" },
  { id:"campaign",label:"活动运营",aliases:["活动运营","活动策划","活动执行","活动复盘"],category:"活动运营",kind:"domain" },
  { id:"community",label:"社区运营",aliases:["社区运营","社群运营","社区治理"],category:"社区运营",kind:"domain" },
  { id:"ecommerce",label:"电商/直播运营",aliases:["电商运营","直播运营","商品运营","gmv"],category:"电商/直播运营",kind:"domain" },
  { id:"brand",label:"品牌/市场",aliases:["品牌营销","品牌传播","市场营销","市场推广","媒介投放"],category:"品牌/市场",kind:"domain" },
  { id:"sales",label:"商务/销售",aliases:["商务拓展","销售","客户开发","渠道拓展","bd"],category:"商务/销售",kind:"domain" },
  { id:"hr",label:"人力资源",aliases:["人力资源","招聘","员工关系","绩效管理","培训发展"],category:"人力资源",kind:"domain" },
  { id:"finance",label:"财务",aliases:["财务分析","会计","审计","预算","报表"],category:"财务",kind:"domain" },
  { id:"coordination",label:"行政/项目协调",aliases:["行政管理","项目协调","会议组织","流程跟进"],category:"行政/项目协调",kind:"domain" },
  { id:"excel",label:"Excel",aliases:["excel","数据透视表","vlookup"],category:"财务",kind:"tool" },
  { id:"communication",label:"沟通协作",aliases:["沟通能力","沟通协作","跨部门协作","团队协作"],category:"未分类",kind:"soft",question:"请用真实经历说明你如何协调相关方推进任务。",answerStructure:"STAR：情境－任务－行动－结果－复盘" },
  { id:"learning",label:"学习能力",aliases:["学习能力","快速学习","自驱学习"],category:"未分类",kind:"soft",question:"请用真实经历说明你如何学习并应用一项新知识。",answerStructure:"学习目标－方法－应用－验证－复盘" },
  { id:"execution",label:"执行与推进",aliases:["执行力","推动落地","项目推进"],category:"行政/项目协调",kind:"soft" },
];
export const JD_CAPABILITY_RULES = rules;

function normalize(value:string){return value.normalize("NFKC").toLowerCase()}
function aliasPattern(alias:string){
  const escaped=normalize(alias).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return /^[a-z0-9+#./ -]+$/i.test(alias) ? new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,"i") : new RegExp(escaped,"i");
}
function findAlias(text:string, aliases:string[]){
  const normalized=normalize(text);
  return aliases.map(alias=>({alias,match:aliasPattern(alias).exec(normalized)})).find(item=>item.match)?.match ?? null;
}
function intensityFor(snippet:string):RequirementIntensity{
  if(/必须|精通|掌握|required|requirement/i.test(snippet)) return "must";
  if(/优先|加分|preferred|plus/i.test(snippet)) return "preferred";
  return "mentioned";
}
function lines(value:string){return value.split(/\r?\n/).map(x=>x.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/,"").trim()).filter(Boolean)}

export function parseJDStructure(jd:string):JDStructure{
  const all=lines(jd); let mode:"responsibilities"|"requirements"|"unsegmented"="unsegmented";
  const responsibilities:string[]=[]; const requirements:string[]=[]; const unsegmented:string[]=[];
  let title="";
  all.forEach((line,index)=>{
    const inlineResponsibility=line.match(/^(岗位职责|工作职责|职位职责|职责描述|responsibilities?)[:：]\s*(.+)$/i);
    if(inlineResponsibility){mode="responsibilities";responsibilities.push(inlineResponsibility[2].trim());return}
    const inlineRequirement=line.match(/^(任职要求|岗位要求|职位要求|资格要求|requirements?|qualifications?)[:：]\s*(.+)$/i);
    if(inlineRequirement){mode="requirements";requirements.push(inlineRequirement[2].trim());return}
    if(/^(岗位职责|工作职责|职位职责|职责描述|responsibilities?)[:：]?$/i.test(line)){mode="responsibilities";return}
    if(/^(任职要求|岗位要求|职位要求|资格要求|requirements?|qualifications?)[:：]?$/i.test(line)){mode="requirements";return}
    if(index===0 && line.length<=40 && !/[。；;]/.test(line)){title=line;return}
    (mode==="responsibilities"?responsibilities:mode==="requirements"?requirements:unsegmented).push(line)
  });
  const source=`${title}\n${jd}`; const counts=new Map<JobCategory,number>();
  rules.forEach(rule=>{if(rule.category&&rule.category!=="未分类"&&findAlias(source,rule.aliases))counts.set(rule.category,(counts.get(rule.category)??0)+1)});
  const titleCategories:[RegExp,JobCategory][]=[[/前端/,"前端"],[/后端|服务端/,"后端"],[/产品经理/,"产品经理"],[/产品运营|增长/,"产品运营/增长"],[/内容运营/,"内容运营"],[/用户运营/,"用户运营"],[/活动运营/,"活动运营"],[/社区|社群/,"社区运营"],[/电商|直播/,"电商/直播运营"],[/品牌|市场/,"品牌/市场"],[/商务|销售/,"商务/销售"],[/人力|招聘/,"人力资源"],[/财务|会计|审计/,"财务"],[/行政|项目协调/,"行政/项目协调"],[/测试/,"测试"],[/数据分析|数据开发/,"数据分析/数据开发"],[/算法|ai/i,"算法/AI"],[/运维|云|安全/,"运维/云/安全"],[/客户端|移动端|android|ios/i,"客户端/移动端"]];
  const byTitle=titleCategories.find(([pattern])=>pattern.test(title))?.[1];
  const category=byTitle??[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??"未分类";
  return {title,responsibilities,requirements,unsegmented,category};
}

export function assessJDInput(jd:string):JDInputStatus{
  const text=jd.trim(); if(!text)return{state:"empty",label:"尚未填写",detail:"请粘贴岗位标题、职责或任职要求。",canAnalyze:false};
  const structure=parseJDStructure(text); const recognized=rules.some(r=>findAlias(text,r.aliases));
  if(structure.title&&!structure.responsibilities.length&&!structure.requirements.length&&!structure.unsegmented.length)return{state:"title-only",label:"仅识别到标题",detail:"请补充职责或任职要求后再分析。",canAnalyze:false};
  if(recognized||structure.requirements.length||structure.responsibilities.length)return{state:"analyzable",label:structure.requirements.length?"可分析":"可分析，但任职要求未明确分段",detail:structure.requirements.length?"将按当前文字提取要求。":"补充任职要求可获得更完整结果。",canAnalyze:true};
  return{state:"insufficient",label:"信息较少",detail:"仍可分析原文，但可能没有预设能力命中。",canAnalyze:true};
}

function requirementsFrom(jd:string,structure:JDStructure){
  const pools:[JDStructure["responsibilities"],RequirementEvidence["section"]][]=[[structure.responsibilities,"responsibilities"],[structure.requirements,"requirements"],[structure.unsegmented,"unsegmented"]];
  const found=new Map<string,Omit<RequirementEvidence,"level"|"sources">>();
  pools.forEach(([items,section])=>items.forEach(line=>line.split(/[；;]/).map(x=>x.trim()).filter(Boolean).forEach(clause=>rules.forEach(rule=>{
    if(!findAlias(clause,rule.aliases))return; const id=rule.id??rule.label;
    const next={id,label:rule.label,kind:rule.kind??"hard",category:rule.category??"未分类",intensity:intensityFor(clause),jdSnippet:clause.slice(0,180),section};
    const old=found.get(id); const rank={must:3,preferred:2,mentioned:1};
    if(!old||rank[next.intensity]>rank[old.intensity])found.set(id,next);
  }))));
  if(!pools.some(([items])=>items.length)) rules.forEach(rule=>{if(findAlias(jd,rule.aliases))found.set(rule.id??rule.label,{id:rule.id??rule.label,label:rule.label,kind:rule.kind??"hard",category:rule.category??"未分类",intensity:intensityFor(jd),jdSnippet:jd.slice(0,180),section:"unsegmented"})});
  return [...found.values()];
}

function hasSoftExperience(text:string,aliases:string[]){return Boolean(findAlias(text,aliases)&&/(负责|协同|协调|推动|组织|沟通并|解决|复盘|主持|跟进|完成)/.test(text))}

export function analyzeJD(jd:string,sections:EvidenceSection[],customRules:KeywordRule[]=rules):KeywordCoverageResult{
  const structure=parseJDStructure(jd); const selected=requirementsFrom(jd,structure).filter(item=>customRules.some(r=>(r.id??r.label)===item.id||r.label===item.label));
  const requirementEvidence:RequirementEvidence[]=selected.map(req=>{
    const rule=customRules.find(r=>(r.id??r.label)===req.id||r.label===req.label)!;
    const matches=sections.filter(s=>req.kind==="soft"&&s.level==="experience"?hasSoftExperience(s.text,rule.aliases):Boolean(findAlias(s.text,rule.aliases)));
    const experienced=matches.filter(s=>s.level==="experience"); const strongest=experienced.length?experienced:matches;
    return{...req,level:experienced.length?"experience":matches.length?"listed":"gap",sources:[...new Set(strongest.map(s=>s.label))]};
  });
  const evidence=requirementEvidence.filter(x=>x.level!=="gap").map(x=>({keyword:x.label,level:x.level as EvidenceLevel,sources:x.sources}));
  const matched=evidence.map(x=>x.keyword); const missing=requirementEvidence.filter(x=>x.level==="gap").map(x=>x.label); const ratio=selected.length?matched.length/selected.length:0;
  return{keywords:selected.map(x=>x.label),matched,missing,evidence,coverageRatio:ratio,coverageLabel:!selected.length?"未识别":ratio>=.7?"覆盖较高":ratio>=.4?"部分覆盖":"覆盖较低",structure,requirements:requirementEvidence,inputStatus:assessJDInput(jd),questions:buildInterviewQuestions(requirementEvidence)};
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
