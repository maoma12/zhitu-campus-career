import assert from "node:assert/strict";
import test from "node:test";

import {
  ANONYMOUS_WORKSPACE_KEY,
  accountWorkspaceKey,
  advanceIdentityEpoch,
  isCurrentIdentity,
  removeCurrentResumeSnapshot,
  removeResumeFromWorkspace,
  resolveAuthenticatedWorkspace,
} from "../app/lib/workspace-security.ts";

type FixtureWorkspace = { owner: string; resumes: string[] };

const cleanWorkspace = (): FixtureWorkspace => ({
  owner: "TEST FIXTURE: clean",
  resumes: [],
});

test("A 用户缓存不会被 B 用户读取", () => {
  const storage = new Map<string, FixtureWorkspace>();
  storage.set(accountWorkspaceKey("TEST-USER-A"), {
    owner: "TEST FIXTURE: A",
    resumes: ["TEST FIXTURE: A resume"],
  });

  assert.notEqual(
    accountWorkspaceKey("TEST-USER-A"),
    accountWorkspaceKey("TEST-USER-B"),
  );
  assert.equal(storage.get(accountWorkspaceKey("TEST-USER-B")), undefined);
});

test("B 云端为空时得到干净工作区，而不是账号缓存", () => {
  const cached: FixtureWorkspace = {
    owner: "TEST FIXTURE: stale B",
    resumes: ["TEST FIXTURE: stale resume"],
  };
  const resolved = resolveAuthenticatedWorkspace(
    { status: "empty" },
    cached,
    cleanWorkspace,
  );

  assert.deepEqual(resolved.workspace, cleanWorkspace());
  assert.equal(resolved.source, "clean");
  assert.equal(resolved.cloudSaveAllowed, true);
});

test("旧公共缓存键和匿名缓存键都不会成为登录账号缓存键", () => {
  const userKey = accountWorkspaceKey("TEST-USER-B");
  assert.notEqual(userKey, "zhitu-workspace-v1");
  assert.notEqual(userKey, "campus-career-prototype");
  assert.notEqual(userKey, ANONYMOUS_WORKSPACE_KEY);

  const resolved = resolveAuthenticatedWorkspace(
    { status: "empty" },
    null,
    cleanWorkspace,
  );
  assert.equal(resolved.source, "clean");
});

test("退出或切换身份后旧用户的延迟保存代次失效", () => {
  const initial = { generation: 0, userId: null };
  const userA = advanceIdentityEpoch(initial, "TEST-USER-A");
  const signedOut = advanceIdentityEpoch(userA, null);
  const userB = advanceIdentityEpoch(signedOut, "TEST-USER-B");

  assert.equal(isCurrentIdentity(userA, signedOut), false);
  assert.equal(isCurrentIdentity(userA, userB), false);
  assert.equal(isCurrentIdentity(userB, userB), true);
});

test("仅云端请求失败时，同一用户可读取自己的账号级缓存", () => {
  const cached: FixtureWorkspace = {
    owner: "TEST FIXTURE: same user",
    resumes: ["TEST FIXTURE: cached resume"],
  };
  const failed = resolveAuthenticatedWorkspace(
    { status: "unavailable" },
    cached,
    cleanWorkspace,
  );
  const empty = resolveAuthenticatedWorkspace(
    { status: "empty" },
    cached,
    cleanWorkspace,
  );

  assert.equal(failed.workspace, cached);
  assert.equal(failed.source, "account-cache");
  assert.equal(failed.cloudSaveAllowed, false);
  assert.deepEqual(empty.workspace, cleanWorkspace());
  assert.equal(empty.source, "clean");
});

test("删除历史快照严格限定当前简历且不影响其他简历", () => {
  const histories = {
    "TEST-RESUME-A": [{ id: "A-1" }, { id: "A-2" }],
    "TEST-RESUME-B": [{ id: "B-1" }],
  };
  const updated = removeCurrentResumeSnapshot(
    histories,
    "TEST-RESUME-A",
    "A-1",
  );

  assert.deepEqual(updated["TEST-RESUME-A"], [{ id: "A-2" }]);
  assert.deepEqual(updated["TEST-RESUME-B"], histories["TEST-RESUME-B"]);
});

type TestResume = { id: string; label: string };
type TestHistory = { id: string };

const testResumes: TestResume[] = [
  { id: "TEST-RESUME-A", label: "TEST FIXTURE A" },
  { id: "TEST-RESUME-B", label: "TEST FIXTURE B" },
  { id: "TEST-RESUME-C", label: "TEST FIXTURE C" },
];
const testHistories: Record<string, TestHistory[]> = {
  "TEST-RESUME-A": [{ id: "TEST-HISTORY-A" }],
  "TEST-RESUME-B": [{ id: "TEST-HISTORY-B" }],
  "TEST-RESUME-C": [{ id: "TEST-HISTORY-C" }],
};
const createTestCleanResume = (): TestResume => ({
  id: "TEST-RESUME-CLEAN",
  label: "TEST FIXTURE CLEAN",
});

test("删除非当前简历时保持当前选择且不改变其他简历", () => {
  const result = removeResumeFromWorkspace(
    testResumes,
    "TEST-RESUME-B",
    testHistories,
    "TEST-RESUME-A",
    createTestCleanResume,
  );
  assert.equal(result.currentId, "TEST-RESUME-B");
  assert.deepEqual(result.resumes, testResumes.slice(1));
  assert.equal(result.resumes[0], testResumes[1]);
  assert.equal(result.createdReplacement, false);
});

test("删除当前简历后确定性选择同位置的相邻简历", () => {
  const result = removeResumeFromWorkspace(
    testResumes,
    "TEST-RESUME-B",
    testHistories,
    "TEST-RESUME-B",
    createTestCleanResume,
  );
  assert.equal(result.currentId, "TEST-RESUME-C");
  assert.deepEqual(
    result.resumes.map((resume) => resume.id),
    ["TEST-RESUME-A", "TEST-RESUME-C"],
  );
});

test("删除末尾的当前简历后选择前一个相邻简历", () => {
  const result = removeResumeFromWorkspace(
    testResumes,
    "TEST-RESUME-C",
    testHistories,
    "TEST-RESUME-C",
    createTestCleanResume,
  );
  assert.equal(result.currentId, "TEST-RESUME-B");
});

test("删除最后一份简历后得到干净新简历并设为当前", () => {
  const result = removeResumeFromWorkspace(
    [testResumes[0]],
    "TEST-RESUME-A",
    testHistories,
    "TEST-RESUME-A",
    createTestCleanResume,
  );
  assert.deepEqual(result.resumes, [createTestCleanResume()]);
  assert.equal(result.currentId, "TEST-RESUME-CLEAN");
  assert.equal(result.createdReplacement, true);
});

test("删除简历只移除目标 histories", () => {
  const result = removeResumeFromWorkspace(
    testResumes,
    "TEST-RESUME-A",
    testHistories,
    "TEST-RESUME-B",
    createTestCleanResume,
  );
  assert.equal("TEST-RESUME-B" in result.histories, false);
  assert.equal(result.histories["TEST-RESUME-A"], testHistories["TEST-RESUME-A"]);
  assert.equal(result.histories["TEST-RESUME-C"], testHistories["TEST-RESUME-C"]);
});
