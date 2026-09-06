import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

import {
  createConcurrentModuleLoader,
  toResumeImportUserMessage,
} from "../app/lib/pdfjs-loader.ts";

test("PDF.js loader coalesces concurrent calls and reuses the loaded module", async () => {
  const moduleValue = { marker: "TEST FIXTURE PDF MODULE" };
  let loaded: typeof moduleValue | undefined;
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const load = createConcurrentModuleLoader({
    getLoaded: () => loaded,
    load: async () => {
      calls += 1;
      await gate;
      loaded = moduleValue;
      return moduleValue;
    },
  });

  const first = load();
  const second = load();
  assert.equal(calls, 1);
  release();
  assert.equal(await first, moduleValue);
  assert.equal(await second, moduleValue);
  assert.equal(await load(), moduleValue);
  assert.equal(calls, 1);
});

test("PDF.js loader clears a failed request so a later attempt can retry", async () => {
  const moduleValue = { marker: "TEST FIXTURE RETRY" };
  let attempts = 0;
  const load = createConcurrentModuleLoader({
    getLoaded: () => undefined,
    load: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("TEST FIXTURE FAILURE");
      return moduleValue;
    },
  });

  await assert.rejects(load(), /TEST FIXTURE FAILURE/);
  assert.equal(await load(), moduleValue);
  assert.equal(attempts, 2);
});

test("PDF.js bridge failures and internal Vite errors map to a safe message", () => {
  const expected = "PDF 解析组件加载失败，请刷新后重试；文件未上传，当前简历未被覆盖。";
  assert.equal(toResumeImportUserMessage(new Error("PDFJS_BRIDGE_LOAD_TIMEOUT")), expected);
  assert.equal(
    toResumeImportUserMessage(new Error("Failed to fetch dynamically imported module /vendor/pdfjs/pdf.min.mjs?import")),
    expected,
  );
  assert.equal(toResumeImportUserMessage(null), "文件解析失败，请换一种格式重试；当前简历未被覆盖。");
});

test("app source uses the public module bridge instead of importing a public PDF.js path", () => {
  const source = readFileSync(new URL("../app/lib/resume-import.ts", import.meta.url), "utf8");
  const loader = readFileSync(new URL("../app/lib/pdfjs-loader.ts", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../public/vendor/pdfjs/pdfjs-bridge.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(source, /import\s*\([^)]*vendor\/pdfjs/s);
  assert.match(loader, /script\.type = "module"/);
  assert.match(bridge, /import \* as pdfjs from "\.\/pdf\.min\.mjs"/);
  assert.match(source, /pdf\.worker\.min\.mjs/);
  assert.ok(statSync(new URL("../public/vendor/pdfjs/pdf.min.mjs", import.meta.url)).size > 400_000);
  assert.ok(statSync(new URL("../public/vendor/pdfjs/pdf.worker.min.mjs", import.meta.url)).size > 1_000_000);
});

test("import review keeps explicit keyboard paging for the scroll region", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /event\.key === "PageDown"[\s\S]*panel\.scrollBy/);
  assert.match(page, /event\.key === "End"[\s\S]*panel\.scrollTo/);
});
