import assert from "node:assert/strict";
import test from "node:test";
import { AI_SCHEMA_VERSION, parseAndValidateAiResponse, validateAiTaskRequest, type AiTaskRequest } from "../app/lib/ai-contract.ts";
import { guardFactBoundCandidate, projectResumeFacts, resumeFactsFingerprint, selectFactsForConsent } from "../app/lib/ai-fact-guard.ts";
import { AiMockError, createOfflineMockResponse, runOfflineAiMock } from "../app/lib/ai-mock.ts";

const request = (overrides: Partial<AiTaskRequest> = {}): AiTaskRequest => ({
  schemaVersion: AI_SCHEMA_VERSION, requestId: "TEST-FIXTURE-request", generation: 3, taskType: "jd_structure",
  identityBinding: { identityGeneration: 8, resumeId: "TEST-FIXTURE-resume", jobTargetId: "TEST-FIXTURE-job" },
  consent: { includeJD: true, includeResumeFullText: false, selectedFactIds: [] },
  input: { jdText: "TEST FIXTURE 前端实习生\n任职要求：必须掌握 React；Java 非必须", facts: [] }, ...overrides,
});

test("AI 请求不携带受信 userId，且拒绝未知任务、版本和超长文本", () => {
  assert.equal(validateAiTaskRequest(request()).ok, true);
  assert.equal("userId" in request().identityBinding, false);
  assert.equal(validateAiTaskRequest({ ...request(), taskType: "resume_write" }).ok, false);
  assert.equal(validateAiTaskRequest({ ...request(), schemaVersion: "unknown" }).ok, false);
  const long = validateAiTaskRequest(request({ input: { jdText: `TEST FIXTURE ${"x".repeat(20_001)}`, facts: [] } }));
  assert.deepEqual(long.ok ? null : long.code, "PAYLOAD_TOO_LARGE");
});

test("响应严格拒绝破损 JSON、无原文来源、非法强度和旧代次", () => {
  const base = createOfflineMockResponse(request());
  assert.equal(parseAndValidateAiResponse(base, request()).ok, true);
  assert.deepEqual(parseAndValidateAiResponse("{broken", request()).ok, false);
  assert.deepEqual(parseAndValidateAiResponse({ ...base, generation: 2 }, request()).ok, false);
  const noSource = structuredClone(base); noSource.result.requirements[0].snippet = "不在 JD 中的内容";
  assert.deepEqual(parseAndValidateAiResponse(noSource, request()).ok, false);
  const badIntensity = structuredClone(base) as unknown as { result: { requirements: Array<Record<string, unknown>> } };
  badIntensity.result.requirements[0].intensity = "expert";
  assert.deepEqual(parseAndValidateAiResponse(badIntensity, request()).ok, false);
});

test("事实投影稳定、默认不选择全文且越权 factId 被拒绝", () => {
  const resume = { id: "TEST-FIXTURE-resume", basic: { name: "测试同学", target: "虚构岗位" }, experiences: [{ id: "exp-a", company: "示例测试公司", role: "测试实习生", period: "2026.01 - 2026.03", description: "完成 3 个 TEST FIXTURE 用例" }], projects: [{ id: "project-a", name: "虚构项目", stack: "React", description: "本地测试" }], skills: "React、Git" };
  const first = projectResumeFacts(resume); const second = projectResumeFacts(structuredClone(resume));
  assert.deepEqual(first, second);
  assert.deepEqual(selectFactsForConsent(first, []), []);
  const selected = first.find((fact) => fact.kind === "company")!;
  const invalidRequest = request({ consent: { includeJD: true, includeResumeFullText: false, selectedFactIds: ["unknown-fact"] }, input: { jdText: request().input.jdText, facts: [selected] } });
  assert.deepEqual(validateAiTaskRequest(invalidRequest).ok, false);
  assert.equal(resumeFactsFingerprint(resume), resumeFactsFingerprint(structuredClone(resume)));
  assert.notEqual(resumeFactsFingerprint(resume), resumeFactsFingerprint({ ...resume, skills: "React、Git、SQL" }));
});

test("防虚构守卫拦截未知 factId，并标记新增数字、技能、公司和日期", () => {
  const facts = projectResumeFacts({ id: "TEST-FIXTURE-resume", experiences: [{ id: "exp-a", company: "示例测试公司", description: "使用 React 完成 3 个用例，时间 2026.01" }] });
  const company = facts.find((fact) => fact.field === "company")!;
  assert.equal(guardFactBoundCandidate({ text: "测试", sourceFactIds: ["unknown"] }, facts).status, "blocked");
  const guarded = guardFactBoundCandidate({ text: "在新增虚构集团使用 Python 完成 9 个用例，时间 2027.02", sourceFactIds: [company.factId] }, facts);
  assert.equal(guarded.status, "needs_confirmation");
  assert.ok(guarded.reasons.length >= 3);
});

test("离线 Mock 支持成功、破损、错误、取消和旧 generation，且不使用网络", async () => {
  assert.equal(parseAndValidateAiResponse(await runOfflineAiMock(request(), "success"), request()).ok, true);
  assert.equal(parseAndValidateAiResponse(await runOfflineAiMock(request(), "broken_json"), request()).ok, false);
  await assert.rejects(() => runOfflineAiMock(request(), "provider_error"), (error: unknown) => error instanceof AiMockError && error.code === "PROVIDER_UNAVAILABLE");
  const controller = new AbortController(); const pending = runOfflineAiMock(request(), "success", controller.signal); controller.abort();
  await assert.rejects(() => pending, (error: unknown) => error instanceof AiMockError && error.code === "CANCELLED");
  const stale = parseAndValidateAiResponse(await runOfflineAiMock(request(), "stale_generation"), request());
  assert.deepEqual(stale.ok ? null : stale.code, "STALE_GENERATION");
});

test("证据映射任务零事实时阻断，不把结构化成功冒充简历匹配", () => {
  const emptyEvidence = request({ taskType: "jd_resume_evidence" });
  const validation = validateAiTaskRequest(emptyEvidence);
  assert.equal(validation.ok, false);
  assert.match(validation.ok ? "" : validation.message, /未选择简历事实/);

  const structure = createOfflineMockResponse(request());
  assert.equal(structure.taskType, "jd_structure");
  assert.equal(structure.result.matchIssues, undefined);
});

test("证据映射按 must gap、listed、experience 分层并排除可选项", () => {
  const facts = projectResumeFacts({
    id: "TEST-FIXTURE-resume",
    experiences: [{ id: "exp-a", description: "TEST FIXTURE 使用 SQL 完成虚构数据核对" }],
    skills: "React",
  });
  const selectedFactIds = facts.map((fact) => fact.factId);
  const evidenceRequest = request({
    taskType: "jd_resume_evidence",
    consent: { includeJD: true, includeResumeFullText: false, selectedFactIds },
    input: {
      jdText: "TEST FIXTURE 任职要求\n必须掌握 React；必须掌握 SQL；必须具备需求分析；沟通能力可选",
      facts,
    },
  });
  assert.equal(validateAiTaskRequest(evidenceRequest).ok, true);
  const response = createOfflineMockResponse(evidenceRequest);
  const validated = parseAndValidateAiResponse(response, evidenceRequest);
  assert.equal(validated.ok, true);
  const issues = response.result.matchIssues ?? [];
  assert.deepEqual(issues.map((item) => [item.requirementId, item.evidenceLevel]), [
    ["product", "gap"],
    ["react", "listed"],
    ["sql", "experience"],
  ]);
  assert.equal(issues.some((item) => item.requirementId === "communication"), false);
  assert.match(issues[0].why, /不代表本人不具备/);
  assert.match(issues[0].nextStep, /真实经历/);
});

test("证据映射响应严格绑定身份、简历与岗位，且不能引用越权事实", () => {
  const facts = projectResumeFacts({ id: "TEST-FIXTURE-resume", skills: "React" });
  const evidenceRequest = request({
    taskType: "jd_resume_evidence",
    consent: { includeJD: true, includeResumeFullText: false, selectedFactIds: facts.map((fact) => fact.factId) },
    input: { jdText: "TEST FIXTURE 任职要求：必须掌握 React", facts },
  });
  const response = createOfflineMockResponse(evidenceRequest);
  const wrongResume = structuredClone(response);
  wrongResume.identityBinding.resumeId = "TEST-FIXTURE-other-resume";
  assert.deepEqual(parseAndValidateAiResponse(wrongResume, evidenceRequest).ok, false);
  const wrongJob = structuredClone(response);
  wrongJob.identityBinding.jobTargetId = "TEST-FIXTURE-other-job";
  assert.deepEqual(parseAndValidateAiResponse(wrongJob, evidenceRequest).ok, false);
  const unauthorized = structuredClone(response);
  unauthorized.result.matchIssues![0].factIds = ["TEST-FIXTURE-other-account-fact"];
  assert.deepEqual(parseAndValidateAiResponse(unauthorized, evidenceRequest).ok, false);
});
