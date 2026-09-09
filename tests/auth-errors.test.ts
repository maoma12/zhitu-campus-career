import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { toPasswordAuthUserMessage } from "../app/lib/auth-errors.ts";

test("登录错误区分错误密码与网络失败且不回显内部错误", () => {
  assert.equal(toPasswordAuthUserMessage(new Error("Invalid login credentials"), "login"), "邮箱或密码错误");
  const network = toPasswordAuthUserMessage(new TypeError("Failed to fetch"), "login");
  assert.match(network, /暂时无法连接账号服务/);
  assert.match(network, /尚未验证邮箱或密码/);
  assert.doesNotMatch(network, /Failed to fetch|https?:\/\//i);
});

test("未知认证错误使用不枚举账号的安全兜底", () => {
  const message = toPasswordAuthUserMessage(new Error("TEST FIXTURE internal detail"), "register");
  assert.equal(message, "暂时无法完成注册，请稍后重试。你仍可使用免登录体验。");
  assert.doesNotMatch(message, /TEST FIXTURE internal detail/);
});

test("访客入口只读取匿名键并由持久化目标阻止 Supabase 保存", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const start = source.indexOf("const enterGuestMode");
  const end = source.indexOf("const exitGuestMode", start);
  const handler = source.slice(start, end);
  assert.match(handler, /readLocalWorkspace\(ANONYMOUS_WORKSPACE_KEY\)/);
  assert.doesNotMatch(handler, /LEGACY_SHARED_WORKSPACE_KEYS|accountWorkspaceKey|loadWorkspace|saveWorkspace|signInWithPassword/);
  assert.match(source, /selectWorkspacePersistenceTarget/);
});

test("生产测试面板仍显式返回空且不进入正式产品路径", async () => {
  const source = await readFile(new URL("../app/ai-phase0-panel.tsx", import.meta.url), "utf8");
  assert.match(source, /process\.env\.NODE_ENV === "production"\) return null/);
});
