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
