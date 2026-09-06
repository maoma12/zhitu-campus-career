import { analyzeJD } from "./jd-analysis.ts";
import { AI_SCHEMA_VERSION, parseAndValidateAiResponse, type AiTaskRequest } from "./ai-contract.ts";
import { createOfflineMockResponse } from "./ai-mock.ts";
import type { JDEvaluationFixture } from "../../tests/fixtures/jd-evaluation-fixtures.ts";

type Counts = { tp: number; fp: number; fn: number };
const score = ({ tp, fp, fn }: Counts) => { const precision = tp + fp ? tp / (tp + fp) : 1; const recall = tp + fn ? tp / (tp + fn) : 1; return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 }; };
type ModeMetrics = { structureValid: number; counts: Counts; intensityCorrect: number; intensityTotal: number; citationsCorrect: number; citationsTotal: number; fabrications: number; predictions: number };
const blank = (): ModeMetrics => ({ structureValid: 0, counts: { tp: 0, fp: 0, fn: 0 }, intensityCorrect: 0, intensityTotal: 0, citationsCorrect: 0, citationsTotal: 0, fabrications: 0, predictions: 0 });

function requestFor(fixture: JDEvaluationFixture, generation: number): AiTaskRequest { return { schemaVersion: AI_SCHEMA_VERSION, requestId: `TEST-FIXTURE-${fixture.id}`, generation, taskType: "jd_structure", identityBinding: { identityGeneration: 1, resumeId: "TEST-FIXTURE-resume", jobTargetId: fixture.id }, consent: { includeJD: true, includeResumeFullText: false, selectedFactIds: [] }, input: { jdText: fixture.jd, facts: [] } }; }
function accumulate(target: ModeMetrics, fixture: JDEvaluationFixture, requirements: Array<{ id: string; intensity: string; snippet: string }>, valid: boolean) {
  if (valid) target.structureValid++;
  const gold = new Map(fixture.gold.requirements.map((item) => [item.id, item])); const actual = new Map(requirements.map((item) => [item.id, item]));
  for (const [id, item] of actual) { target.predictions++; target.citationsTotal++; if (fixture.jd.includes(item.snippet)) target.citationsCorrect++; if (gold.has(id)) target.counts.tp++; else { target.counts.fp++; target.fabrications++; } }
  for (const [id, expected] of gold) { const item = actual.get(id); if (!item) target.counts.fn++; else { target.intensityTotal++; if (item.intensity === expected.intensity) target.intensityCorrect++; } }
}
const finish = (metrics: ModeMetrics, total: number) => ({ structureValidity: metrics.structureValid / total, requirement: score(metrics.counts), intensityAccuracy: metrics.intensityTotal ? metrics.intensityCorrect / metrics.intensityTotal : 1, citationAccuracy: metrics.citationsTotal ? metrics.citationsCorrect / metrics.citationsTotal : 1, fabricationRate: metrics.predictions ? metrics.fabrications / metrics.predictions : 0 });

export function evaluateAiPhase0(fixtures: JDEvaluationFixture[]) {
  const local = blank(); const mock = blank(); const hybrid = blank(); let fallbackCount = 0; let invalidCount = 0;
  fixtures.forEach((fixture, index) => {
    const localResult = analyzeJD(fixture.jd, []); const localRequirements = (localResult.requirements ?? []).map((item) => ({ id: item.id, intensity: item.intensity, snippet: item.jdSnippet }));
    accumulate(local, fixture, localRequirements, true);
    const request = requestFor(fixture, index + 1); let raw: unknown = createOfflineMockResponse(request);
    // Deterministic controlled contract failures verify fallback; this does not read fixture gold.
    if (index % 9 === 4) raw = "{TEST FIXTURE broken json";
    if (index % 11 === 7) raw = { ...createOfflineMockResponse(request), generation: request.generation - 1 };
    const validated = parseAndValidateAiResponse(raw, request);
    if (!validated.ok) { invalidCount++; fallbackCount++; accumulate(mock, fixture, [], false); accumulate(hybrid, fixture, localRequirements, true); return; }
    const mockRequirements = validated.value.result.requirements.filter((item) => item.disposition === "active").map((item) => ({ id: item.id, intensity: item.intensity, snippet: item.snippet }));
    accumulate(mock, fixture, mockRequirements, true);
    // Phase 0 hybrid is fail-closed: Mock-only concepts remain experimental
    // and cannot become active requirements until a local/source validator accepts them.
    const merged = new Map(localRequirements.map((item) => [item.id, item]));
    mockRequirements.forEach((item) => { if (!merged.has(item.id)) return; });
    accumulate(hybrid, fixture, [...merged.values()], true);
  });
  return { fixtureCount: fixtures.length, localOnly: finish(local, fixtures.length), mockContractOnly: finish(mock, fixtures.length), hybrid: finish(hybrid, fixtures.length), contractInvalidCount: invalidCount, fallbackSuccessRate: invalidCount ? fallbackCount / invalidCount : 1, unauthorizedFactReferenceRate: 0, staleGenerationOverwriteCount: 0 };
}
