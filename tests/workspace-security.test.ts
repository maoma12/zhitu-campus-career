import assert from "node:assert/strict";
import test from "node:test";

import {
  ANONYMOUS_WORKSPACE_KEY,
  accountWorkspaceKey,
  advanceIdentityEpoch,
  isCurrentIdentity,
  removeCurrentResumeSnapshot,
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
