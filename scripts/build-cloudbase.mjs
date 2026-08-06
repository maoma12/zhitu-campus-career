import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const clientDir = path.join(projectRoot, "dist", "client");
const outputDir = path.join(projectRoot, "cloudbase-dist");
const sourceUrl = process.env.CLOUDBASE_SOURCE_URL;
const targetOrigin =
  process.env.CLOUDBASE_TARGET_ORIGIN ??
  "https://zhitu-career-d7gbchi0a816651a3-1460815801.tcloudbaseapp.com";

async function renderEntryDocument() {
  if (sourceUrl) {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "zhitu-cloudbase-static-builder/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Unable to render CloudBase entry document: ${response.status}`,
      );
    }

    const source = new URL(sourceUrl);
    const escapedHost = source.host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const sourceOriginPattern = new RegExp(`https?://${escapedHost}`, "g");

    return (await response.text()).replace(sourceOriginPattern, targetOrigin);
  }

  const serverEntry = pathToFileURL(
    path.join(projectRoot, "dist", "server", "index.js"),
  );
  const { default: worker } = await import(
    `${serverEntry.href}?cloudbase=${Date.now()}`
  );
  const response = await worker.fetch(
    new Request(`${targetOrigin}/`),
    {
      ASSETS: {
        fetch: () => new Response(null, { status: 404 }),
      },
    },
    { waitUntil() {} },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to render local CloudBase entry document: ${response.status}`,
    );
  }

  return response.text();
}

const html = (await renderEntryDocument())
  .replace(
    /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/g,
    targetOrigin,
  )
  .replace(
    /https:\/\/zhitu-campus-career\.(?:zhitu-career\.workers\.dev|m72554083\.chatgpt\.site)/g,
    targetOrigin,
  );

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });
await writeFile(path.join(outputDir, "index.html"), html, "utf8");
await writeFile(path.join(outputDir, "404.html"), html, "utf8");

console.log(`CloudBase static build ready at ${outputDir}`);
