import { AI_SCHEMA_VERSION, type AiMatchIssue, type AiRequirement, type AiTaskRequest, type AiTaskResponse } from "./ai-contract.ts";

export type AiMockMode = "success" | "timeout" | "broken_json" | "provider_error" | "stale_generation";
export class AiMockError extends Error {
  code: "PROVIDER_TIMEOUT" | "PROVIDER_UNAVAILABLE" | "CANCELLED";
  constructor(code: "PROVIDER_TIMEOUT" | "PROVIDER_UNAVAILABLE" | "CANCELLED", message: string) { super(message); this.code = code; }
}

const rules: Array<{ id: string; label: string; aliases: string[]; kind: AiRequirement["kind"] }> = [
  { id: "react", label: "React", aliases: ["react"], kind: "hard" },
  { id: "java", label: "Java", aliases: ["java"], kind: "hard" },
  { id: "sql", label: "SQL", aliases: ["sql"], kind: "hard" },
  { id: "python", label: "Python", aliases: ["python"], kind: "hard" },
  { id: "product", label: "需求分析", aliases: ["需求分析", "prd"], kind: "hard" },
  { id: "content", label: "内容运营", aliases: ["内容运营", "内容策划"], kind: "domain" },
  { id: "communication", label: "沟通协作", aliases: ["沟通能力", "跨部门协作"], kind: "soft" },
  { id: "excel", label: "Excel", aliases: ["excel"], kind: "tool" },
];
const clauses = (text: string) => text.split(/\r?\n|[。；;]/).map((item) => item.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, "").trim()).filter(Boolean);
const matchesAlias = (snippet: string, alias: string) => {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return /^[a-z0-9+#.-]+$/i.test(alias) ? new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(snippet) : snippet.toLowerCase().includes(alias.toLowerCase());
};
const sectionFor = (snippet: string, full: string): AiRequirement["source"] => {
  const before = full.slice(0, full.indexOf(snippet));
  const markers = [...before.matchAll(/岗位职责|工作内容|任职要求|岗位要求|加分项/gi)];
  const marker = markers.at(-1)?.[0] ?? "";
  return { section: /职责|工作内容/.test(marker) ? "responsibilities" : /加分/.test(marker) ? "preferred" : /要求/.test(marker) ? "requirements" : "unsegmented", inferred: !marker };
};

export function createOfflineMockResponse(request: AiTaskRequest): AiTaskResponse {
  const found: AiRequirement[] = [];
  clauses(request.input.jdText).forEach((snippet) => rules.forEach((rule, ruleIndex) => {
    if ((request.taskType === "jd_structure" && ruleIndex % 2 === 1) || found.some((item) => item.id === rule.id) || !rule.aliases.some((alias) => matchesAlias(snippet, alias))) return;
    const excluded = /无需|不要求|非必须|not required/i.test(snippet);
    const optional = /可选|optional/i.test(snippet);
    const preferred = /优先|加分|preferred|plus/i.test(snippet);
    const matchedFacts = request.input.facts.filter((fact) => rule.aliases.some((alias) => matchesAlias(fact.text, alias)));
    found.push({ id: rule.id, label: rule.label, kind: rule.kind, intensity: preferred ? "preferred" : /必须|掌握|required|must/i.test(snippet) ? "must" : "mentioned", disposition: excluded ? "excluded" : optional ? "optional" : "active", snippet, source: sectionFor(snippet, request.input.jdText), factIds: matchedFacts.map((fact) => fact.factId), needsConfirmation: false });
  }));
  const matchIssues: AiMatchIssue[] = found
    .filter((item) => item.disposition === "active")
    .map((item) => {
      const facts = request.input.facts.filter((fact) => item.factIds.includes(fact.factId));
      const hasExperience = facts.some((fact) => ["experience", "education", "project", "campus"].includes(fact.module));
      const evidenceLevel: AiMatchIssue["evidenceLevel"] = hasExperience ? "experience" : facts.length ? "listed" : "gap";
      return {
        requirementId: item.id,
        label: item.label,
        snippet: item.snippet,
        intensity: item.intensity,
        evidenceLevel,
        factIds: facts.map((fact) => fact.factId),
        why: evidenceLevel === "gap"
          ? "在已选择的简历事实中未找到对应文字；这只是证据缺口，不代表本人不具备。"
          : evidenceLevel === "listed"
            ? "只在技能、简介或其他陈述中找到文字，尚未看到同一经历条目中的行动证据。"
            : "已选择的教育、实习、项目或校园经历中存在对应文字证据。",
        nextStep: evidenceLevel === "gap"
          ? "先核实是否有真实经历；如有，只补充已经发生且可核验的事实。"
          : evidenceLevel === "listed"
            ? "如确有相关经历，可在对应条目中补充真实行动与结果；不要新增未发生的内容。"
            : "核对引用是否准确，再决定是否调整已有事实的表达顺序。",
      };
    })
    .sort((a, b) => {
      const rank = (item: AiMatchIssue) => item.evidenceLevel === "gap" && item.intensity === "must" ? 0 : item.evidenceLevel === "gap" ? 1 : item.evidenceLevel === "listed" ? 2 : 3;
      return rank(a) - rank(b) || a.requirementId.localeCompare(b.requirementId);
    });
  const title = request.input.jdText.split(/\r?\n/).map((item) => item.trim()).find(Boolean)?.slice(0, 120) ?? null;
  const result: AiTaskResponse["result"] = { title, category: null, confidence: null, sections: [], requirements: found, constraints: [], warnings: ["AI 接入测试预览：未连接模型，文本未上传。"] };
  if (request.taskType === "jd_resume_evidence") result.matchIssues = matchIssues;
  return { schemaVersion: AI_SCHEMA_VERSION, requestId: request.requestId, generation: request.generation, taskType: request.taskType, identityBinding: request.identityBinding, provider: { kind: "mock", model: "offline-deterministic-test-double", offline: true }, result, usage: { inputUnits: request.input.jdText.length + request.input.facts.reduce((sum, fact) => sum + fact.text.length, 0), outputUnits: JSON.stringify(result).length, latencyMs: 40 } };
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new AiMockError("CANCELLED", "本地模拟已取消")); return; }
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new AiMockError("CANCELLED", "本地模拟已取消")); }, { once: true });
});

export async function runOfflineAiMock(request: AiTaskRequest, mode: AiMockMode, signal?: AbortSignal): Promise<unknown> {
  await wait(mode === "stale_generation" ? 1_500 : 40, signal);
  if (mode === "timeout") throw new AiMockError("PROVIDER_TIMEOUT", "本地模拟超时，已保留本地规则结果");
  if (mode === "provider_error") throw new AiMockError("PROVIDER_UNAVAILABLE", "本地模拟服务错误，已保留本地规则结果");
  if (mode === "broken_json") return "{broken TEST FIXTURE json";
  const response = createOfflineMockResponse(request);
  return mode === "stale_generation" ? { ...response, generation: Math.max(0, request.generation - 1) } : response;
}
