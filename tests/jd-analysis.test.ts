import assert from "node:assert/strict";
import test from "node:test";
import { JD_CAPABILITY_RULES, analyzeJD, assessJDInput, compareJobTargets, parseJDStructure, type EvidenceSection } from "../app/lib/jd-analysis.ts";

const resume:EvidenceSection[]=[
  {label:"项目经历",level:"experience",text:"TEST FIXTURE：负责 React 页面与用户调研，协同虚构团队推动活动复盘。"},
  {label:"技能特长",level:"listed",text:"TEST FIXTURE：MySQL、Excel、沟通能力"},
];

const fixtures:[string,string][]=[
  ["前端","前端开发\n任职要求：\n掌握 React 与 TypeScript"],["后端","后端开发\n任职要求：\n必须掌握 Java 与 MySQL"],
  ["客户端/移动端","移动端开发\n任职要求：\n熟悉 Android Kotlin"],["测试","测试工程师\n任职要求：\n掌握自动化测试与测试用例"],
  ["数据分析/数据开发","数据分析\n任职要求：\n熟悉 Python、SQL 与数据分析"],["算法/AI","算法工程师\n任职要求：\n掌握机器学习与 PyTorch"],
  ["运维/云/安全","云安全工程师\n任职要求：\n熟悉 Linux、云平台和网络安全"],["产品经理","产品经理\n任职要求：\n负责需求分析、PRD 与用户调研"],
  ["产品运营/增长","增长运营\n任职要求：\n负责增长策略与留存率"],["内容运营","内容运营\n任职要求：\n负责内容策划与文案撰写"],
  ["用户运营","用户运营\n任职要求：\n负责用户分层与生命周期"],["活动运营","活动运营\n任职要求：\n负责活动策划与活动复盘"],
  ["社区运营","社区运营\n任职要求：\n负责社群运营"],["电商/直播运营","直播运营\n任职要求：\n负责直播运营与 GMV"],
  ["品牌/市场","品牌市场\n任职要求：\n负责品牌传播和市场推广"],["商务/销售","商务拓展\n任职要求：\n负责客户开发与渠道拓展"],
  ["人力资源","人力资源\n任职要求：\n负责招聘与员工关系"],["财务","财务分析\n任职要求：\n负责预算与报表"],
  ["行政/项目协调","项目协调\n任职要求：\n负责会议组织与流程跟进"],
];
test("常见校招岗位分类均可解释",()=>fixtures.forEach(([expected,jd])=>assert.equal(parseJDStructure(`TEST FIXTURE ${jd}`).category,expected)));

test("通用报表语境不会被误识别为财务能力",()=>{
  const analysis=analyzeJD("TEST FIXTURE 数据分析实习生\n岗位职责：负责虚构业务报表。\n任职要求：必须掌握 SQL",[]);
  assert.equal(analysis.structure.category,"数据分析/数据开发");
  assert.equal(analysis.requirements.some((item)=>item.id==="finance"),false);
});
test("能力概念包含 hard/soft/domain/tool 与中英文 aliases",()=>{
  assert.deepEqual(new Set(JD_CAPABILITY_RULES.map(x=>x.kind)),new Set(["hard","soft","domain","tool"]));
  const result=analyzeJD("TEST FIXTURE 数据岗\n任职要求：必须掌握 SQL；Python preferred；了解数据分析",resume);
  assert.deepEqual(result.requirements?.map(x=>x.intensity),["must","preferred","mentioned"]);
});
test("同义词去重且 MySQL 不重复命中 SQL",()=>{
  const mysql=analyzeJD("TEST FIXTURE 后端\n任职要求：熟悉 MySQL mysql",resume);
  assert.deepEqual(mysql.keywords,["MySQL"]);
});
test("结构分段与无法可靠分段均诚实保留",()=>{
  const split=parseJDStructure("TEST FIXTURE 产品经理\n岗位职责：\n负责用户调研\n任职要求：\n掌握需求分析");
  assert.equal(split.responsibilities.length,1);assert.equal(split.requirements.length,1);
  const inline=parseJDStructure("TEST FIXTURE 产品经理\n岗位职责：负责用户调研\n任职要求：掌握需求分析");
  assert.deepEqual(inline.responsibilities,["负责用户调研"]);assert.deepEqual(inline.requirements,["掌握需求分析"]);
  assert.deepEqual(parseJDStructure("TEST FIXTURE 未知岗位\n协助整理资料").unsegmented,["协助整理资料"]);
});
test("输入完整性不使用固定字数门槛",()=>{
  assert.equal(assessJDInput("").state,"empty");assert.equal(assessJDInput("产品经理").state,"title-only");
  assert.equal(assessJDInput("产品经理\n任职要求：\n熟悉 PRD").canAnalyze,true);
});
test("逐要求映射 experience/listed/gap，软能力需可追溯动作",()=>{
  const result=analyzeJD("TEST FIXTURE 前端\n任职要求：\n必须掌握 React\n熟悉 MySQL\n具备沟通能力\n了解 Redis",resume);
  assert.deepEqual(result.requirements?.map(x=>[x.label,x.level]),[["React","experience"],["MySQL","listed"],["沟通协作","listed"],["Redis","gap"]]);
});
test("面试题按强度与缺口排序，来源和无证据提示明确",()=>{
  const result=analyzeJD("TEST FIXTURE 后端\n任职要求：\n必须掌握 Redis\n必须掌握 Java\n优先熟悉 Git",resume);
  assert.equal(result.questions?.[0].tag.includes("必须"),true);
  assert.equal(result.questions?.some(x=>x.safetyNote.includes("不能编造")),true);
  assert.equal(new Set(result.questions?.map(x=>x.question)).size,result.questions?.length);
});
test("多岗位比较只给事实维度、共同项和独有项",()=>{
  const a=analyzeJD("TEST FIXTURE 前端\n任职要求：React、Git",resume);const b=analyzeJD("TEST FIXTURE 后端\n任职要求：Java、Git",resume);
  const compared=compareJobTargets([{id:"A",name:"A",analysis:a},{id:"B",name:"B",analysis:b}]);
  assert.deepEqual(compared.common,["Git"]);assert.deepEqual(compared.items[0].unique,["React"]);assert.deepEqual(compared.items[1].unique,["Java"]);
  assert.equal("score" in compared,false);
});

test("否定与可选语义优先于强度词，且不制造缺口",()=>{
  const result=analyzeJD("TEST FIXTURE 后端\n任职要求：无需掌握 Java；Redis 非必须；MySQL optional；必须掌握 SQL",[]);
  assert.deepEqual(result.requirements?.map(x=>x.id),["sql"]);
  assert.deepEqual(result.excludedRequirements?.map(x=>[x.id,x.disposition]),[["java","excluded"],["redis","excluded"],["mysql","optional"]]);
  assert.deepEqual(result.missing,["SQL"]);
});

test("英文 Requirements 章节名不把全部条目误判为 must",()=>{
  const result=analyzeJD("TEST FIXTURE Data Intern\nRequirements\nSQL preferred\nPython knowledge\nJava required",[]);
  assert.deepEqual(Object.fromEntries((result.requirements??[]).map(x=>[x.id,x.intensity])),{sql:"preferred",python:"mentioned",java:"must"});
});

test("职责、任职要求、加分项和未分段推断保留来源",()=>{
  const result=analyzeJD("TEST FIXTURE 前端\n工作内容：必须使用 React 完成页面。任职资格：掌握 TypeScript。加分项：熟悉 Vue",[]);
  const items=Object.fromEntries((result.requirements??[]).map(x=>[x.id,x]));
  assert.equal(items.react.section,"responsibilities");assert.equal(items.react.intensity,"mentioned");
  assert.equal(items.javascript.section,"requirements");assert.equal(items.javascript.intensity,"must");
  assert.equal(items.vue.section,"preferred");assert.equal(items.vue.intensity,"preferred");
  const inferred=analyzeJD("TEST FIXTURE 未知岗位\n熟悉 Redis",[]).requirements?.[0];
  assert.equal(inferred?.inferred,true);
});

test("短词使用词界且通用工具不足以强行分类",()=>{
  assert.equal(analyzeJD("TEST FIXTURE English copy\nWe go to market and train people",[]).keywords.includes("Go"),false);
  assert.deepEqual(analyzeJD("TEST FIXTURE Systems\n任职要求：C、C++、R、AI、BD、HR、PRD",[]).keywords,["C/C++","R","机器学习/算法","需求分析","商务/销售","人力资源"]);
  assert.equal(parseJDStructure("TEST FIXTURE 实习生\n任职要求：Git、Excel、Python").category,"unknown");
  assert.equal(parseJDStructure("TEST FIXTURE 工程师\n任职要求：React、Java").category,"ambiguous");
});

test("非技能约束只做描述性提取，不声称简历满足",()=>{
  const result=analyzeJD("TEST FIXTURE 产品实习生\n任职要求：本科及以上学历；2027 年毕业；每周实习 4 天；英语六级；需提供作品集；可接受出差",[]);
  assert.deepEqual(new Set(result.constraints?.map(x=>x.id)),new Set(["education","graduation","internship","language","portfolio","travel"]));
  assert.equal(result.requirements?.length,0);
});

test("软能力证据不能跨条目拼接",()=>{
  const sections:EvidenceSection[]=[
    {label:"项目 1",level:"experience",text:"具备沟通能力。"},
    {label:"项目 2",level:"experience",text:"负责协调成员并推动任务完成。"},
  ];
  const result=analyzeJD("TEST FIXTURE 运营\n任职要求：具备沟通能力",sections);
  assert.equal(result.requirements?.find(x=>x.id==="communication")?.level,"gap");
});

test("面试题优先 must gap，通用题明确标注 supplemental",()=>{
  const result=analyzeJD("TEST FIXTURE 后端\n任职要求：必须掌握 Redis；MySQL preferred",[]);
  assert.equal(result.questions?.[0].requirement,"Redis");
  assert.equal(result.questions?.[0].tag.includes("必须 · 待确认"),true);
  assert.equal(result.questions?.filter(x=>x.supplemental).every(x=>x.tag==="通用补充"),true);
});
