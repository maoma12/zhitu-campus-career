import type { AiFact } from "./ai-contract.ts";

type ResumeEntry = object & { id?: string };
export type ResumeFactSource = {
  id: string;
  basic?: object;
  experiences?: ResumeEntry[];
  educations?: ResumeEntry[];
  projects?: ResumeEntry[];
  campusExperiences?: ResumeEntry[];
  skills?: string;
  certificate?: string;
  evaluation?: string;
  portfolio?: string;
};

export type ResumeFactPack = {
  factId: string;
  module: "experience" | "education" | "project" | "campus" | "skills" | "certificate";
  itemId: string;
  title: string;
  period: string;
  summary: string;
  evidenceLevel: "experience" | "listed";
};

const hash = (value: string) => {
  let result = 2166136261;
  for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(36);
};
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const safePart = (value: string) => encodeURIComponent(value.slice(0, 160));
const classify = (field: string, text: string): AiFact["kind"] => {
  if (/company|school|department/.test(field)) return "company";
  if (/role|degree|major/.test(field)) return "role";
  if (/name/.test(field)) return "project";
  if (/period/.test(field) || /(?:19|20)\d{2}[.年/-]/.test(text)) return "date";
  if (/skills|stack/.test(field)) return "skill";
  if (/\d/.test(text)) return "number";
  return "text";
};

export function projectResumeFacts(resume: ResumeFactSource): AiFact[] {
  const facts: AiFact[] = [];
  const add = (module: string, entryId: string, field: string, value: unknown) => {
    const text = clean(value); if (!text) return;
    facts.push({ factId: `resume:${safePart(resume.id)}:${safePart(module)}:${safePart(entryId)}:${safePart(field)}`, module, entryId, field, kind: classify(field, text), text });
  };
  Object.entries(resume.basic ?? {}).forEach(([field, value]) => add("basic", "basic", field, value));
  const groups: Array<[string, ResumeEntry[] | undefined]> = [["experience", resume.experiences], ["education", resume.educations], ["project", resume.projects], ["campus", resume.campusExperiences]];
  groups.forEach(([module, entries]) => (entries ?? []).forEach((entry, index) => Object.entries(entry).forEach(([field, value]) => field !== "id" && add(module, clean(entry.id) || `${module}-${index}`, field, value))));
  clean(resume.skills).split(/[·,，、|｜\n]/).map((item) => item.trim()).filter(Boolean).forEach((skill) => facts.push({ factId: `resume:${safePart(resume.id)}:skills:${hash(skill.normalize("NFKC").toLowerCase())}`, module: "skills", entryId: "skills", field: "skills", kind: "skill", text: skill }));
  [["certificate", resume.certificate], ["evaluation", resume.evaluation], ["portfolio", resume.portfolio]].forEach(([field, value]) => add(String(field), String(field), String(field), value));
  return facts;
}

const packFields: Record<ResumeFactPack["module"], string[]> = {
  experience: ["company", "role", "period", "description"],
  education: ["school", "major", "degree", "period", "detail"],
  project: ["name", "role", "period", "stack", "description"],
  campus: ["department", "period", "description"],
  skills: ["skills"],
  certificate: ["certificate"],
};

/** Projects only non-sensitive, locally auditable resume content into item-level packs. */
export function projectResumeFactPacks(resume: ResumeFactSource): ResumeFactPack[] {
  const packs: ResumeFactPack[] = [];
  const addEntries = (module: ResumeFactPack["module"], entries: ResumeEntry[] | undefined) => {
    (entries ?? []).forEach((entry, index) => {
      const itemId = clean(entry.id) || `${module}-${index}`;
      const values = packFields[module].map((field) => clean((entry as Record<string, unknown>)[field])).filter(Boolean);
      if (!values.length) return;
      const period = clean((entry as Record<string, unknown>).period);
      const titleFields = module === "experience" ? ["company", "role"] : module === "education" ? ["school", "major"] : module === "project" ? ["name", "role"] : ["department"];
      const title = titleFields.map((field) => clean((entry as Record<string, unknown>)[field])).filter(Boolean).join(" · ") || `第 ${index + 1} 项`;
      packs.push({ factId: `pack:${safePart(resume.id)}:${module}:${safePart(itemId)}`, module, itemId, title, period, summary: values.join("；").slice(0, 1200), evidenceLevel: "experience" });
    });
  };
  addEntries("experience", resume.experiences);
  addEntries("education", resume.educations);
  addEntries("project", resume.projects);
  addEntries("campus", resume.campusExperiences);
  const addListed = (module: "skills" | "certificate", value: unknown, title: string) => {
    const summary = clean(value); if (!summary) return;
    packs.push({ factId: `pack:${safePart(resume.id)}:${module}:${hash(summary.normalize("NFKC").toLowerCase())}`, module, itemId: module, title, period: "", summary: summary.slice(0, 1200), evidenceLevel: "listed" });
  };
  addListed("skills", resume.skills, "技能组");
  addListed("certificate", resume.certificate, "证书荣誉");
  return packs;
}

export function factPacksToAiFacts(packs: readonly ResumeFactPack[]): AiFact[] {
  return packs.map((pack) => ({ factId: pack.factId, module: pack.module, entryId: pack.itemId, field: "fact_pack", kind: pack.module === "skills" ? "skill" : "text", text: pack.summary }));
}

export function resumeFactsFingerprint(resume: ResumeFactSource) {
  return hash(projectResumeFacts(resume)
    .map((fact) => `${fact.factId}\u001f${fact.kind}\u001f${fact.text}`)
    .join("\u001e"));
}

export function selectFactsForConsent(allFacts: AiFact[], selectedFactIds: readonly string[]) {
  const selected = new Set(selectedFactIds);
  return allFacts.filter((fact) => selected.has(fact.factId));
}

export type FactBoundCandidate = { text: string; sourceFactIds: string[] };
export type FactGuardResult = { status: "allowed" | "needs_confirmation" | "blocked"; reasons: string[] };

const tokens = (text: string, pattern: RegExp) => [...new Set(text.match(pattern) ?? [])];
const missing = (candidate: string[], source: string) => candidate.filter((item) => !source.includes(item));

export function guardFactBoundCandidate(candidate: FactBoundCandidate, allowedFacts: readonly AiFact[]): FactGuardResult {
  const allowed = new Map(allowedFacts.map((fact) => [fact.factId, fact]));
  const reasons: string[] = [];
  if (!candidate.sourceFactIds.length || candidate.sourceFactIds.some((id) => !allowed.has(id))) reasons.push("引用了未授权或不存在的 factId");
  const source = candidate.sourceFactIds.map((id) => allowed.get(id)?.text ?? "").join(" ");
  if (missing(tokens(candidate.text, /(?<![\w])\d+(?:\.\d+)?%?|(?:19|20)\d{2}(?:[.年/-]\d{1,2})?/g), source).length) reasons.push("新增或改变了数字/日期");
  if (missing(tokens(candidate.text, /[\u4e00-\u9fffA-Za-z0-9]+(?:公司|集团|银行|研究院|实验室)/g), source).length) reasons.push("新增了公司或组织名称");
  const skillPattern = /\b(?:Java|Python|React|Vue|TypeScript|JavaScript|SQL|MySQL|Redis|Linux|Git|Excel|C\+\+|Go)\b/gi;
  if (missing(tokens(candidate.text, skillPattern).map((item) => item.toLowerCase()), source.toLowerCase()).length) reasons.push("新增了未授权技能");
  if (reasons.some((reason) => reason.includes("factId"))) return { status: "blocked", reasons };
  return reasons.length ? { status: "needs_confirmation", reasons } : { status: "allowed", reasons: [] };
}
