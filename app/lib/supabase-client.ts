"use client";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const sessionKey = "zhitu-supabase-session";

export const cloudConfigured = Boolean(supabaseUrl && publishableKey);

function headers(accessToken?: string) {
  return {
    apikey: publishableKey,
    Authorization: `Bearer ${accessToken ?? publishableKey}`,
    "Content-Type": "application/json",
  };
}

async function readJson(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.msg ?? data?.message ?? data?.error_description ?? "请求失败");
  }
  return data;
}

function storeSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(sessionKey);
    return;
  }
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

function sessionFromPayload(payload: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  user: { id: string; email?: string };
}): AuthSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt:
      payload.expires_at ??
      Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600),
    user: {
      id: payload.user.id,
      email: payload.user.email ?? "",
    },
  };
}

export async function signInWithPassword(email: string, password: string) {
  if (!cloudConfigured) throw new Error("Supabase 尚未配置");
  const response = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ email, password }),
    },
  );
  const session = sessionFromPayload(await readJson(response));
  storeSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!cloudConfigured) throw new Error("Supabase 尚未配置");
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email,
      password,
      data: { source: "zhitu" },
    }),
  });
  const payload = await readJson(response);
  if (!payload?.access_token || !payload?.refresh_token) {
    throw new Error(
      "注册成功，但当前仍要求邮件确认。请联系网站管理员关闭注册邮箱确认后再试。",
    );
  }
  const session = sessionFromPayload(payload);
  storeSession(session);
  return session;
}

export async function consumeAuthRedirect(): Promise<AuthSession | null> {
  if (!cloudConfigured) return null;
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const errorDescription =
    query.get("error_description") ?? fragment.get("error_description");
  if (errorDescription) {
    history.replaceState(null, "", location.pathname);
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }

  const tokenHash = query.get("token_hash");
  if (tokenHash) {
    const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        token_hash: tokenHash,
        type: query.get("type") ?? "email",
      }),
    });
    const session = sessionFromPayload(await readJson(response));
    storeSession(session);
    history.replaceState(null, "", location.pathname);
    return session;
  }

  const accessToken =
    fragment.get("access_token") ?? query.get("access_token");
  const refreshToken =
    fragment.get("refresh_token") ?? query.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: headers(accessToken),
  });
  const user = await readJson(userResponse);
  const session: AuthSession = {
    accessToken,
    refreshToken,
    expiresAt:
      Math.floor(Date.now() / 1000) +
      Number(fragment.get("expires_in") ?? query.get("expires_in") ?? 3600),
    user: { id: user.id, email: user.email ?? "" },
  };
  storeSession(session);
  history.replaceState(null, "", location.pathname);
  return session;
}

export async function getSession(): Promise<AuthSession | null> {
  if (!cloudConfigured) return null;
  const raw = localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (session.expiresAt > Math.floor(Date.now() / 1000) + 60) return session;
    const response = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      },
    );
    const next = sessionFromPayload(await readJson(response));
    storeSession(next);
    return next;
  } catch {
    storeSession(null);
    return null;
  }
}

export async function signOut(session: AuthSession | null) {
  if (session && cloudConfigured) {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: "POST",
      headers: headers(session.accessToken),
    }).catch(() => undefined);
  }
  storeSession(null);
}

export async function loadWorkspace<T>(session: AuthSession): Promise<T | null> {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/resume_workspaces?select=payload&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    { headers: headers(session.accessToken) },
  );
  const rows = (await readJson(response)) as { payload: T }[];
  return rows[0]?.payload ?? null;
}

export async function saveWorkspace<T>(session: AuthSession, payload: T) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/resume_workspaces?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        ...headers(session.accessToken),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        payload,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  await readJson(response);
}
