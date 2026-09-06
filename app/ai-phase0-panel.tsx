"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AI_SCHEMA_VERSION,
  parseAndValidateAiResponse,
  validateAiTaskRequest,
  type AiFact,
  type AiMatchIssue,
  type AiTaskRequest,
  type AiTaskResponse,
  type AiTaskType,
} from "./lib/ai-contract.ts";
import {
  factPacksToAiFacts,
  projectResumeFactPacks,
  selectFactsForConsent,
  type ResumeFactSource,
} from "./lib/ai-fact-guard.ts";
import { AiMockError, runOfflineAiMock, type AiMockMode } from "./lib/ai-mock.ts";

type Status = "idle" | "running" | "success" | "error" | "cancelled";

const factModuleLabel: Record<string, string> = {
  basic: "基本信息陈述",
  experience: "实习 / 工作经历",
  education: "教育经历",
  project: "项目经历",
  campus: "校园经历",
  skills: "技能陈述",
  certificate: "证书荣誉",
  evaluation: "自我评价",
  portfolio: "作品展示",
};
const evidenceLabel: Record<AiMatchIssue["evidenceLevel"], string> = {
  gap: "未找到文字证据",
  listed: "只有陈述，缺少经历证据",
  experience: "已有经历证据",
};
const factLabel = (fact: AiFact) => `${factModuleLabel[fact.module] ?? fact.module} · 事实包`;

export function AiPhase0Panel({ jdText, resume, resumeId, jobTargetId, identityGeneration }: {
  jdText: string;
  resume: ResumeFactSource;
  resumeId: string;
  jobTargetId: string | null;
  identityGeneration: number;
}) {
  const availableFacts = useMemo(
    () => factPacksToAiFacts(projectResumeFactPacks(resume)).slice(0, 40),
    [resume],
  );
  const [confirmed, setConfirmed] = useState(false);
  const [taskType, setTaskType] = useState<AiTaskType>("jd_resume_evidence");
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>(() => availableFacts.map((fact) => fact.factId));
  const [mode, setMode] = useState<AiMockMode>("success");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("尚未运行；未执行简历匹配");
  const [response, setResponse] = useState<AiTaskResponse | null>(null);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement | null>(null);
  const statusId = useId();
  const invalidate = (nextMessage: string) => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setResponse(null);
    setStatus("idle");
    setMessage(nextMessage);
  };

  useEffect(() => () => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  if (process.env.NODE_ENV === "production") return null;

  const selectedFacts = selectFactsForConsent(availableFacts, selectedFactIds);
  const matchingBlocked = taskType === "jd_resume_evidence" && selectedFacts.length === 0;

  const toggleFact = (factId: string, checked: boolean) => {
    setSelectedFactIds((current) => checked ? [...current, factId] : current.filter((id) => id !== factId));
    invalidate("事实范围已变化；旧结果已清除，请重新运行");
  };

  const run = async () => {
    if (matchingBlocked) {
      setStatus("error");
      setMessage("未选择简历事实，无法判断匹配问题");
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const request: AiTaskRequest = {
      schemaVersion: AI_SCHEMA_VERSION,
      requestId: `phase0-${identityGeneration}-${resumeId}-${jobTargetId ?? "unsaved"}-${generation}`,
      generation,
      taskType,
      identityBinding: { identityGeneration, resumeId, jobTargetId },
      consent: { includeJD: true, includeResumeFullText: false, selectedFactIds: selectedFacts.map((fact) => fact.factId) },
      input: { jdText, facts: selectedFacts },
    };
    const requestValidation = validateAiTaskRequest(request);
    if (!confirmed || !requestValidation.ok) {
      setStatus("error");
      setMessage(!confirmed ? "请先确认本地测试与事实范围" : requestValidation.message);
      return;
    }
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setStatus("running");
    setMessage(taskType === "jd_structure" ? "正在测试结构化接入；尚未执行简历匹配，文本未上传" : "正在进行离线文字证据映射；文本未上传");
    setResponse(null);
    try {
      const raw = await runOfflineAiMock(request, mode, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      const validation = parseAndValidateAiResponse(raw, request);
      if (!validation.ok) {
        setStatus("error");
        setMessage(`${validation.message}；已降级并保留现有本地规则结果`);
        return;
      }
      setResponse(validation.value);
      setStatus("success");
      setMessage(taskType === "jd_structure" ? "接入基础设施 / JD 结构化测试成功；尚未执行简历匹配" : "离线证据映射已完成；下列问题仅表示文字证据缺口，不代表能力不足");
      if (taskType === "jd_resume_evidence") {
        // WCAG 2.2 focus flow: after explicit submission, move keyboard and
        // screen-reader users to the newly rendered, non-persistent result.
        requestAnimationFrame(() => {
          resultRef.current?.focus();
          resultRef.current?.scrollIntoView({ block: "start" });
        });
      }
    } catch (error) {
      if (generation !== generationRef.current) return;
      const cancelled = error instanceof AiMockError && error.code === "CANCELLED";
      setStatus(cancelled ? "cancelled" : "error");
      setMessage(error instanceof Error ? error.message : "离线 Mock 失败，已保留现有本地规则结果");
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const cancel = () => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStatus("cancelled");
    setMessage("已取消离线 Mock；现有本地规则结果保持不变");
    setResponse(null);
  };

  const matchIssues = response?.taskType === "jd_resume_evidence" ? response.result.matchIssues ?? [] : [];
  const issueGroups = [
    { key: "must-gap", label: "必须要求且未找到证据", items: matchIssues.filter((item) => item.evidenceLevel === "gap" && item.intensity === "must") },
    { key: "other-gap", label: "其他要求待核实", items: matchIssues.filter((item) => item.evidenceLevel === "gap" && item.intensity !== "must") },
    { key: "listed", label: "只有陈述，缺少经历证据", items: matchIssues.filter((item) => item.evidenceLevel === "listed") },
    { key: "experience", label: "已有经历证据", items: matchIssues.filter((item) => item.evidenceLevel === "experience") },
  ].filter((group) => group.items.length);

  return (
    <details className="ai-phase0-panel">
      <summary>AI 接入测试预览（未连接模型）</summary>
      <div className="ai-phase0-body">
        <p className="ai-phase0-notice"><strong>当前只是本地测试。</strong>JD 结构化成功只证明接入合同可用，不代表已完成简历匹配；不会调用 AI API、上传或保存文本。</p>
        <fieldset>
          <legend>测试任务</legend>
          <label className="ai-phase0-mode">本地 Mock 内容
            <select value={taskType} onChange={(event) => {
              setTaskType(event.target.value as AiTaskType);
              invalidate(event.target.value === "jd_structure" ? "已切换为结构化测试；该任务不会判断简历匹配" : "已切换为证据映射；请选择简历事实后运行");
            }}>
              <option value="jd_resume_evidence">JD—简历匹配问题预览</option>
              <option value="jd_structure">仅测试 JD 结构化基础设施</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>未来发送的数据范围</legend>
          <dl><div><dt>当前 JD</dt><dd>{jdText.length} 字</dd></div><div><dt>简历全文</dt><dd>不包含</dd></div><div><dt>已选简历事实</dt><dd>{selectedFacts.length} 项</dd></div></dl>
          <details><summary>查看当前 JD（仅本地显示）</summary><pre>{jdText || "尚未填写 JD"}</pre></details>
          <details className="ai-phase0-fact-picker" open>
            <summary>选择用于匹配的简历事实包（默认全选，可取消）</summary>
            {availableFacts.length ? <fieldset><legend className="sr-only">可选择的当前简历事实</legend>{availableFacts.map((fact) => (
              <label key={fact.factId}><input type="checkbox" checked={selectedFactIds.includes(fact.factId)} onChange={(event) => toggleFact(fact.factId, event.target.checked)} /><span><strong>{factLabel(fact)}</strong><small>{fact.text}</small></span></label>
            ))}</fieldset> : <p>当前简历没有可用于岗位证据映射的文字事实。</p>}
          </details>
          {matchingBlocked && <p className="ai-phase0-blocked" role="status">未选择简历事实，无法判断匹配问题。</p>}
          <label className="ai-phase0-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} aria-describedby={statusId} />我确认当前只运行本地模拟，并仅使用上方勾选的事实</label>
        </fieldset>
        <label className="ai-phase0-mode">异常与竞态测试模式<select value={mode} onChange={(event) => { setMode(event.target.value as AiMockMode); invalidate("测试模式已变化；旧结果已清除"); }}><option value="success">成功</option><option value="timeout">超时降级</option><option value="broken_json">破损 JSON</option><option value="provider_error">Provider 错误</option><option value="stale_generation">旧代次响应</option></select></label>
        <div className="ai-phase0-actions"><button type="button" onClick={() => void run()} disabled={matchingBlocked || !jdText.trim()} aria-describedby={statusId}>{taskType === "jd_structure" ? "运行结构化测试" : "生成匹配问题预览"}</button>{status === "running" && <button type="button" onClick={cancel}>取消</button>}</div>
        <p id={statusId} className={`ai-phase0-status ${status}`} role={status === "error" ? "alert" : undefined} aria-live="polite">{message}</p>
        {response?.taskType === "jd_resume_evidence" && (
          <section ref={resultRef} tabIndex={-1} className="ai-match-problems" aria-labelledby="ai-match-problems-title">
            <header><h3 id="ai-match-problems-title">匹配问题</h3><p>离线 Mock · 仅比较当前 JD 与明确勾选的简历事实。问题不等于能力不足。</p></header>
            {matchIssues.length ? issueGroups.map((group) => {
              return <section key={group.key}><h4>{group.label}（{group.items.length}）</h4><ol>{group.items.map((item) => (
                <li key={item.requirementId}><h5>{item.label} · {item.intensity === "must" ? "必须" : item.intensity === "preferred" ? "加分" : "提及"}</h5><dl>
                  <div><dt>JD 原句</dt><dd><q>{item.snippet}</q></dd></div><div><dt>证据级别</dt><dd>{evidenceLabel[item.evidenceLevel]}</dd></div>
                  <div><dt>已选事实来源</dt><dd>{item.factIds.length ? item.factIds.map((id) => { const fact = selectedFacts.find((candidate) => candidate.factId === id); return fact ? `${factLabel(fact)}：${fact.text}` : "已失效事实"; }).join("；") : "未找到"}</dd></div>
                  <div><dt>为什么是问题</dt><dd>{item.why}</dd></div><div><dt>下一步</dt><dd>{item.nextStep}</dd></div>
                </dl></li>
              ))}</ol></section>;
            }) : <p>当前 Mock 未识别到可映射的有效要求；不会为了填满结果而伪造问题。</p>}
            <small>requestId、代次、身份、简历与岗位均绑定；结果未写入岗位卡、工作区或历史。</small>
          </section>
        )}
        {response?.taskType === "jd_structure" && <details className="ai-phase0-result"><summary>查看 Mock 结构化对照</summary><p>标题：{response.result.title ?? "待确认"}</p><p>类别：{response.result.category ?? "待确认"}</p><ul>{response.result.requirements.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.intensity} · {item.disposition}</span><q>{item.snippet}</q></li>)}</ul><small>接入基础设施 / 结构化测试成功；尚未执行简历匹配。现有本地规则结果仍在下方匹配分析中。</small></details>}
      </div>
    </details>
  );
}
