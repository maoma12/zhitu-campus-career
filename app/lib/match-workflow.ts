import type { JDConstraint, RequirementEvidence } from "./jd-analysis.ts";
import type { ResumeFactPack } from "./ai-fact-guard.ts";

export type ConstraintStatus = "satisfied" | "not_satisfied" | "insufficient" | "not_applicable";
export type MatchReviewDecision = "inaccurate" | "confirmed_gap";
export type MatchReviewState = Record<string, MatchReviewDecision>;
export type ConstraintAssessment = JDConstraint & { status: ConstraintStatus; reason: string };
export type PriorityMatchItem = {
  id: string;
  kind: "requirement" | "constraint";
  label: string;
  snippet: string;
  intensity: RequirementEvidence["intensity"];
  evidenceLevel: RequirementEvidence["level"] | "insufficient" | "satisfied" | "not_satisfied" | "not_applicable";
  sources: string[];
  reason: string;
  nextStep: string;
  suggestedModule: ResumeFactPack["module"] | null;
  priority: number;
};

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
const moduleFor = (requirement: RequirementEvidence): ResumeFactPack["module"] | null => {
  const source = requirement.sources.join(" ");
  if (/实习|工作/.test(source)) return "experience";
  if (/项目/.test(source)) return "project";
  if (/教育/.test(source)) return "education";
  if (/校园/.test(source)) return "campus";
  if (/技能/.test(source) || requirement.kind === "tool" || requirement.kind === "hard") return "skills";
  return null;
};

export function assessConstraint(constraint: JDConstraint, packs: readonly ResumeFactPack[]): ConstraintAssessment {
  const relevant = packs.filter((pack) => constraint.id === "education" || constraint.id === "major" || constraint.id === "graduation" ? pack.module === "education" : constraint.id === "certificate" || constraint.id === "language" ? pack.module === "certificate" || pack.module === "skills" : false);
  if (!["education", "major", "graduation", "certificate", "language"].includes(constraint.id)) return { ...constraint, status: "not_applicable", reason: "当前简历数据模型没有可可靠自动核对的对应字段，请本人确认。" };
  if (!relevant.length) return { ...constraint, status: "insufficient", reason: "简历中没有足够的对应文字，不能据此判断是否满足。" };
  const source = normalized(relevant.map((pack) => pack.summary).join(" "));
  const snippet = normalized(constraint.jdSnippet);
  if (constraint.id === "graduation") {
    const expected = snippet.match(/20\d{2}/)?.[0];
    const actual = source.match(/20\d{2}/)?.[0];
    if (expected && actual) return { ...constraint, status: expected === actual ? "satisfied" : "not_satisfied", reason: expected === actual ? "教育经历中有相同毕业年份文字。" : "教育经历中的毕业年份与 JD 明确年份不同，请核实。" };
  }
  if (constraint.id === "education") {
    const rank = (text: string) => text.includes("博士") ? 4 : text.includes("硕士") ? 3 : text.includes("本科") ? 2 : text.includes("大专") || text.includes("专科") ? 1 : 0;
    const expected = rank(snippet); const actual = rank(source);
    if (expected && actual) return { ...constraint, status: actual >= expected ? "satisfied" : "not_satisfied", reason: actual >= expected ? "教育经历中的学历文字达到 JD 明确要求。" : "教育经历中的学历文字低于 JD 明确要求，请核实。" };
  }
  const meaningful = snippet.match(/[\u4e00-\u9fffA-Za-z]{2,}/g)?.filter((token) => !/要求|优先|具备|相关|专业|熟悉/.test(token)) ?? [];
  if (meaningful.some((token) => source.includes(normalized(token)))) return { ...constraint, status: "satisfied", reason: "当前简历对应事实包中有直接文字证据。" };
  return { ...constraint, status: "insufficient", reason: "没有足够的直接文字证据；信息不足不等于不满足。" };
}

export function buildPriorityMatchItems(requirements: readonly RequirementEvidence[], constraints: readonly JDConstraint[], packs: readonly ResumeFactPack[], reviews: MatchReviewState, limit = 5): PriorityMatchItem[] {
  const requirementItems = requirements.filter((item) => reviews[item.id] !== "inaccurate").flatMap<PriorityMatchItem>((item) => {
    if (item.level === "experience") return [];
    const confirmed = reviews[item.id] === "confirmed_gap";
    const priority = item.level === "gap" && item.intensity === "must" ? 0 : item.level === "listed" ? 20 : item.level === "gap" ? 30 : 40;
    return [{ id: item.id, kind: "requirement", label: item.label, snippet: item.jdSnippet, intensity: item.intensity, evidenceLevel: item.level, sources: item.sources, reason: item.level === "listed" ? "当前只在技能、简介或其他陈述中命中，尚未找到同一段经历里的行动证据。" : confirmed ? "你已确认当前确实没有对应经历；本次分析不再重复催促补写。" : "当前简历文字未找到对应证据；这不等于你不具备该能力。", nextStep: confirmed ? "保留为已确认缺口；如情况变化，请重新分析后核实。" : "只在确有真实经历时前往相关模块补充；否则保持缺口，不要照抄 JD。", suggestedModule: moduleFor(item), priority: priority + (confirmed ? 50 : 0) }];
  });
  const constraintItems = constraints.map((item) => assessConstraint(item, packs)).filter((item) => item.status === "not_satisfied" || item.status === "insufficient").map<PriorityMatchItem>((item) => ({ id: `constraint:${item.id}:${item.jdSnippet}`, kind: "constraint", label: item.label, snippet: item.jdSnippet, intensity: item.intensity, evidenceLevel: item.status, sources: [], reason: item.reason, nextStep: "请对照真实情况核实；仅在简历已有相关事实时补充表达。", suggestedModule: item.id === "education" || item.id === "major" || item.id === "graduation" ? "education" : null, priority: item.status === "not_satisfied" ? 10 : 15 }));
  return [...requirementItems, ...constraintItems].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)).slice(0, Math.max(0, limit));
}

export function updateMatchReview(current: MatchReviewState, requirementId: string, decision: MatchReviewDecision | null): MatchReviewState {
  const next = { ...current }; if (decision) next[requirementId] = decision; else delete next[requirementId]; return next;
}

export function filterSuggestionsByReview<T extends { requirementId?: string }>(suggestions: readonly T[], reviews: MatchReviewState): T[] {
  return suggestions.filter((item) => !item.requirementId || reviews[item.requirementId] !== "inaccurate");
}

export function isAnalysisBindingCurrent(binding: { identityGeneration: number; resumeId: string; jobTargetId: string; factsFingerprint: string }, current: { identityGeneration: number; resumeId: string; jobTargetId: string; factsFingerprint: string }) {
  return binding.identityGeneration === current.identityGeneration && binding.resumeId === current.resumeId && binding.jobTargetId === current.jobTargetId && binding.factsFingerprint === current.factsFingerprint;
}
