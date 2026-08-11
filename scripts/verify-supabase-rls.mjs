import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const allowDedicatedWorkspaceOverwrite = process.argv.includes(
  "--allow-overwrite-dedicated-test-workspaces",
);

function parseEnv(text) {
  const values = new Map();
  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error("MALFORMED_ENV");
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
}

function selectCredential(env, account, kind) {
  const accountPattern = account === "A" ? /(^|_)A(_|$)|ACCOUNT_A|USER_A/i : /(^|_)B(_|$)|ACCOUNT_B|USER_B/i;
  const kindPattern = kind === "email" ? /EMAIL/i : /PASS(?:WORD)?/i;
  const matches = [...env].filter(
    ([name, value]) => accountPattern.test(name) && kindPattern.test(name) && value.trim(),
  );
  if (matches.length !== 1) throw new Error("CREDENTIAL_ROLE_MISSING_OR_AMBIGUOUS");
  return matches[0][1];
}

async function readPublicConfigFromCurrentBuild() {
  const html = await readFile(resolve(root, "cloudbase-dist", "index.html"), "utf8");
  const assetPaths = [
    ...new Set(
      [...html.matchAll(/["'](\/assets\/[^"']+\.js)["']/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  if (!assetPaths.length) throw new Error("CURRENT_BUILD_ENTRY_NOT_FOUND");
  const bundles = await Promise.all(
    assetPaths.map((path) => readFile(resolve(root, "cloudbase-dist", path.slice(1)), "utf8")),
  );
  const bundle = bundles.join("\n");
  const urls = [...new Set(bundle.match(/https:\/\/[a-z0-9-]+\.supabase\.co/gi) ?? [])];
  const keys = [
    ...new Set([
      ...(bundle.match(/sb_publishable_[A-Za-z0-9_-]+/g) ?? []),
      ...(bundle.match(/eyJ[A-Za-z0-9._-]{80,}/g) ?? []),
    ]),
  ];
  if (urls.length !== 1 || keys.length < 1) throw new Error("PUBLIC_CONFIG_NOT_UNAMBIGUOUS");
  return { url: urls[0].replace(/\/$/, ""), key: keys[0] };
}

function headers(key, token, prefer) {
  return {
    apikey: key,
    Authorization: `Bearer ${token ?? key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function responseJson(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return text ? JSON.parse(text) : null;
}

async function signIn(config, email, password) {
  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(config.key),
    body: JSON.stringify({ email, password }),
  });
  const body = await responseJson(response);
  if (!body?.access_token || !body?.user?.id) throw new Error("AUTH_RESPONSE_INCOMPLETE");
  return { status: response.status, token: body.access_token, userId: body.user.id };
}

async function ownRows(config, session) {
  const response = await fetch(
    `${config.url}/rest/v1/resume_workspaces?select=user_id,payload&user_id=eq.${encodeURIComponent(session.userId)}&limit=1`,
    { headers: headers(config.key, session.token, "count=exact") },
  );
  const rows = await responseJson(response);
  return { status: response.status, rows };
}

function isRecognizedTestPayload(payload) {
  const marker = payload?.rls_test;
  return Boolean(
    marker &&
      marker.fixture === "RLS TEST FIXTURE" &&
      marker.suite === "zhitu-minimal-rls-v1" &&
      (marker.owner === "A" || marker.owner === "B" || marker.owner === "CROSS_ATTEMPT"),
  );
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

async function upsertOwn(config, session, payload) {
  const response = await fetch(
    `${config.url}/rest/v1/resume_workspaces?on_conflict=user_id`,
    {
      method: "POST",
      headers: headers(config.key, session.token, "resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({ user_id: session.userId, payload }),
    },
  );
  const rows = await responseJson(response);
  return { status: response.status, affected: Array.isArray(rows) ? rows.length : 0 };
}

async function crossSelect(config, actor, targetUserId) {
  const response = await fetch(
    `${config.url}/rest/v1/resume_workspaces?select=user_id&user_id=eq.${encodeURIComponent(targetUserId)}`,
    { headers: headers(config.key, actor.token, "count=exact") },
  );
  const rows = await responseJson(response);
  return { status: response.status, visible: Array.isArray(rows) ? rows.length : 0 };
}

async function crossUpdate(config, actor, targetUserId, payload) {
  const response = await fetch(
    `${config.url}/rest/v1/resume_workspaces?user_id=eq.${encodeURIComponent(targetUserId)}`,
    {
      method: "PATCH",
      headers: headers(config.key, actor.token, "return=representation,count=exact"),
      body: JSON.stringify({ payload }),
    },
  );
  const body = await responseJson(response);
  return { status: response.status, affected: Array.isArray(body) ? body.length : 0 };
}

async function logout(config, session) {
  const response = await fetch(`${config.url}/auth/v1/logout`, {
    method: "POST",
    headers: headers(config.key, session.token),
  });
  await response.text();
  return response.status;
}

const sanitized = {
  fixture: "RLS TEST FIXTURE",
  credentialVariables: { required: 4, presentAndNonempty: 0, pass: false },
  preflight: null,
  auth: null,
  ownAccess: null,
  crossSelect: null,
  crossUpdate: null,
  unchangedAfterCrossUpdate: null,
  cleanup: {
    workspaceWritesPerformed: false,
    retainedSyntheticRows: 0,
    rowsDeleted: false,
    reason: "No workspace write has occurred.",
  },
  overall: "FAIL",
};

let sessions = [];
let markers = [];
let config;
try {
  const env = parseEnv(await readFile(resolve(root, ".env.rls-test.local"), "utf8"));
  const credentials = {
    aEmail: selectCredential(env, "A", "email"),
    aPassword: selectCredential(env, "A", "password"),
    bEmail: selectCredential(env, "B", "email"),
    bPassword: selectCredential(env, "B", "password"),
  };
  sanitized.credentialVariables = { required: 4, presentAndNonempty: 4, pass: true };
  config = await readPublicConfigFromCurrentBuild();
  const a = await signIn(config, credentials.aEmail, credentials.aPassword);
  const b = await signIn(config, credentials.bEmail, credentials.bPassword);
  sessions = [a, b];
  sanitized.auth = { statuses: [a.status, b.status], pass: true };

  const [beforeA, beforeB] = await Promise.all([ownRows(config, a), ownRows(config, b)]);
  const safeA = beforeA.rows.length === 0 || (beforeA.rows.length === 1 && isRecognizedTestPayload(beforeA.rows[0].payload));
  const safeB = beforeB.rows.length === 0 || (beforeB.rows.length === 1 && isRecognizedTestPayload(beforeB.rows[0].payload));
  sanitized.preflight = {
    statuses: [beforeA.status, beforeB.status],
    existingRows: [beforeA.rows.length, beforeB.rows.length],
    onlyEmptyOrRecognizedTestData: safeA && safeB,
    userAuthorizedDedicatedWorkspaceOverwrite: allowDedicatedWorkspaceOverwrite,
    pass: (safeA && safeB) || allowDedicatedWorkspaceOverwrite,
  };
  if ((!safeA || !safeB) && !allowDedicatedWorkspaceOverwrite) {
    throw new Error("NON_TEST_WORKSPACE_PRESENT");
  }

  markers = ["A", "B"].map((owner) => ({
    rls_test: {
      fixture: "RLS TEST FIXTURE",
      suite: "zhitu-minimal-rls-v1",
      owner,
      nonce: randomUUID(),
    },
  }));
  const [writeA, writeB] = await Promise.all([
    upsertOwn(config, a, markers[0]),
    upsertOwn(config, b, markers[1]),
  ]);
  sanitized.cleanup = {
    workspaceWritesPerformed: true,
    retainedSyntheticRows: 2,
    rowsDeleted: false,
    reason: "No DELETE policy is defined; synthetic markers are retained.",
  };
  const [readA, readB] = await Promise.all([ownRows(config, a), ownRows(config, b)]);
  const ownPass =
    writeA.affected === 1 &&
    writeB.affected === 1 &&
    readA.rows.length === 1 &&
    readB.rows.length === 1 &&
    sameJson(readA.rows[0].payload, markers[0]) &&
    sameJson(readB.rows[0].payload, markers[1]);
  sanitized.ownAccess = {
    writeStatuses: [writeA.status, writeB.status],
    affectedRows: [writeA.affected, writeB.affected],
    readStatuses: [readA.status, readB.status],
    visibleRows: [readA.rows.length, readB.rows.length],
    pass: ownPass,
  };

  const [aSeesB, bSeesA] = await Promise.all([
    crossSelect(config, a, b.userId),
    crossSelect(config, b, a.userId),
  ]);
  sanitized.crossSelect = {
    statuses: [aSeesB.status, bSeesA.status],
    visibleRows: [aSeesB.visible, bSeesA.visible],
    pass: aSeesB.visible === 0 && bSeesA.visible === 0,
  };

  const crossPayload = {
    rls_test: {
      fixture: "RLS TEST FIXTURE",
      suite: "zhitu-minimal-rls-v1",
      owner: "CROSS_ATTEMPT",
      nonce: randomUUID(),
    },
  };
  const [aUpdatesB, bUpdatesA] = await Promise.all([
    crossUpdate(config, a, b.userId, crossPayload),
    crossUpdate(config, b, a.userId, crossPayload),
  ]);
  sanitized.crossUpdate = {
    statuses: [aUpdatesB.status, bUpdatesA.status],
    affectedRows: [aUpdatesB.affected, bUpdatesA.affected],
    pass: aUpdatesB.affected === 0 && bUpdatesA.affected === 0,
  };

  const [afterA, afterB] = await Promise.all([ownRows(config, a), ownRows(config, b)]);
  const unchanged =
    afterA.rows.length === 1 &&
    afterB.rows.length === 1 &&
    sameJson(afterA.rows[0].payload, markers[0]) &&
    sameJson(afterB.rows[0].payload, markers[1]);
  sanitized.unchangedAfterCrossUpdate = {
    statuses: [afterA.status, afterB.status],
    visibleRows: [afterA.rows.length, afterB.rows.length],
    pass: unchanged,
  };
  if (!unchanged) {
    await Promise.all([upsertOwn(config, a, markers[0]), upsertOwn(config, b, markers[1])]);
  }

  sanitized.overall =
    ownPass && sanitized.crossSelect.pass && sanitized.crossUpdate.pass && unchanged
      ? "PASS"
      : "FAIL";
} catch (error) {
  sanitized.errorCode = error instanceof Error ? error.message.replace(/[^A-Z0-9_]/g, "_") : "UNKNOWN_ERROR";
} finally {
  if (config && sessions.length) {
    sanitized.logoutStatuses = await Promise.all(
      sessions.map((session) => logout(config, session).catch(() => 0)),
    );
  }
}

console.log(JSON.stringify(sanitized, null, 2));
if (sanitized.overall !== "PASS") process.exitCode = 1;
