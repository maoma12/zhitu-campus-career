export const ANONYMOUS_WORKSPACE_KEY = "zhitu-workspace-anonymous-v1";

export const LEGACY_SHARED_WORKSPACE_KEYS = [
  "zhitu-workspace-v1",
  "campus-career-prototype",
] as const;

const ACCOUNT_WORKSPACE_KEY_PREFIX = "zhitu-workspace-user-v1:";

export function accountWorkspaceKey(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("用户 ID 不能为空");
  return `${ACCOUNT_WORKSPACE_KEY_PREFIX}${encodeURIComponent(normalizedUserId)}`;
}

export type IdentityEpoch = {
  generation: number;
  userId: string | null;
};

export function advanceIdentityEpoch(
  current: IdentityEpoch,
  userId: string | null,
): IdentityEpoch {
  return { generation: current.generation + 1, userId };
}

export function isCurrentIdentity(
  expected: IdentityEpoch,
  current: IdentityEpoch,
) {
  return (
    expected.generation === current.generation &&
    expected.userId === current.userId
  );
}

export type WorkspaceLoadResult<T> =
  | { status: "found"; workspace: T }
  | { status: "empty" }
  | { status: "unavailable" };

export type ResolvedWorkspace<T> = {
  workspace: T;
  source: "cloud" | "clean" | "account-cache";
  cloudSaveAllowed: boolean;
};

export function resolveAuthenticatedWorkspace<T>(
  cloud: WorkspaceLoadResult<T>,
  accountCache: T | null,
  createCleanWorkspace: () => T,
): ResolvedWorkspace<T> {
  if (cloud.status === "found") {
    return {
      workspace: cloud.workspace,
      source: "cloud",
      cloudSaveAllowed: true,
    };
  }
  if (cloud.status === "empty") {
    return {
      workspace: createCleanWorkspace(),
      source: "clean",
      cloudSaveAllowed: true,
    };
  }
  return {
    workspace: accountCache ?? createCleanWorkspace(),
    source: accountCache ? "account-cache" : "clean",
    // A failed read must never be followed by an automatic write that could
    // overwrite a newer cloud workspace which the client could not inspect.
    cloudSaveAllowed: false,
  };
}

export function removeCurrentResumeSnapshot<T extends { id: string }>(
  histories: Record<string, T[]>,
  currentResumeId: string,
  snapshotId: string,
) {
  return {
    ...histories,
    [currentResumeId]: (histories[currentResumeId] ?? []).filter(
      (snapshot) => snapshot.id !== snapshotId,
    ),
  };
}
