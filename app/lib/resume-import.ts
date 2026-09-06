"use client";

import {
  loadPdfJsModule,
  type PdfTextItem,
} from "./pdfjs-loader.ts";

export type ParsedResumeText = {
  rawText: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  education: string;
  experience: string;
  project: string;
  campus: string;
  skills: string;
  certificate: string;
  evaluation: string;
  portfolio: string;
};

export function splitResumeEntries(text: string) {
  return text
    .trim()
    .split(/\n\s*\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeOcrText(text: string) {
  return normalizeText(text)
    .replace(/([\u3400-\u9fff])[\t ]+(?=[\u3400-\u9fff])/g, "$1")
    .replace(/[\t ]+([，。；：、！？）】》])/g, "$1")
    .replace(/([（【《])[\t ]+/g, "$1");
}

export function joinPdfRowItems(items: PdfTextItem[]) {
  let previousEnd: number | null = null;
  return [...items]
    .sort(
      (a, b) =>
        (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0),
    )
    .reduce((result, item) => {
      const text = item.str ?? "";
      const x = item.transform?.[4] ?? 0;
      const fontSize = Math.max(
        Math.abs(item.transform?.[0] ?? 0),
        Math.abs(item.transform?.[3] ?? 0),
        1,
      );
      const visualGap = previousEnd === null ? 0 : x - previousEnd;
      const separator =
        result &&
        !/\s$/.test(result) &&
        !/^\s/.test(text) &&
        visualGap > fontSize * 0.35
          ? " "
          : "";
      previousEnd = x + (item.width ?? 0);
      return `${result}${separator}${text}`;
    }, "")
    .trim();
}

type TesseractGlobal = {
  createWorker(
    languages: string[],
    engineMode?: number,
    options?: Record<string, unknown>,
  ): Promise<{
    recognize(file: File): Promise<{ data: { text: string } }>;
    terminate(): Promise<void>;
  }>;
};

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function readPdf(file: File) {
  const pdfjs = await loadPdfJsModule();
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const positioned = content.items.filter(
      (item) =>
        item.str?.trim() &&
        item.transform &&
        item.transform.length >= 6,
    );
    if (positioned.length >= content.items.length * 0.6) {
      const rows: { y: number; items: PdfTextItem[] }[] = [];
      positioned.forEach((item) => {
        const y = item.transform?.[5] ?? 0;
        const row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
        if (row) {
          row.items.push(item);
        } else {
          rows.push({ y, items: [item] });
        }
      });
      pages.push(
        rows
          .sort((a, b) => b.y - a.y)
          .map((row) =>
            joinPdfRowItems(row.items),
          )
          .join("\n"),
      );
    } else {
      pages.push(
        content.items
          .map((item) => `${item.str ?? ""}${item.hasEOL ? "\n" : " "}`)
          .join(""),
      );
    }
  }
  return normalizeText(pages.join("\n\n"));
}

function findEndOfCentralDirectory(view: DataView) {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function inflateRaw(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntry(buffer: ArrayBuffer, entryName: string) {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error("无法读取 DOCX 压缩结构");
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(
      new Uint8Array(buffer, offset + 46, fileNameLength),
    );
    if (name === entryName) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = new Uint8Array(buffer, dataOffset, compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRaw(compressed);
      throw new Error("DOCX 使用了暂不支持的压缩方式");
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error("DOCX 中未找到正文");
}

async function readDocx(file: File) {
  const xmlBytes = await readZipEntry(await file.arrayBuffer(), "word/document.xml");
  const xml = new TextDecoder().decode(xmlBytes);
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return normalizeText(
    Array.from(document.getElementsByTagNameNS("*", "p"))
      .map((paragraph) =>
        Array.from(paragraph.getElementsByTagNameNS("*", "t"))
          .map((node) => node.textContent ?? "")
          .join(""),
      )
      .filter(Boolean)
      .join("\n"),
  );
}

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/tesseract/tesseract.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("本地 OCR 引擎加载失败"));
    document.head.appendChild(script);
  });
}

async function readImage(file: File, onProgress?: (value: number) => void) {
  await loadTesseractScript();
  if (!window.Tesseract) throw new Error("本地 OCR 引擎不可用");
  const worker = await window.Tesseract.createWorker(["chi_sim", "eng"], 1, {
    workerPath: "/vendor/tesseract/worker.min.js",
    corePath: "/vendor/tesseract/tesseract-core-simd-lstm.wasm.js",
    langPath: "/vendor/tesseract/lang",
    logger: (message: { progress?: number }) => {
      if (typeof message.progress === "number") onProgress?.(message.progress);
    },
  });
  try {
    const result = await worker.recognize(file);
    return normalizeOcrText(result.data.text);
  } finally {
    await worker.terminate();
  }
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headingMatch(line: string, names: string[]) {
  const pattern = names.map(escapePattern).join("|");
  return line.match(
    new RegExp(`^\\s*(?:${pattern})\\s*(?:[:：|｜]\\s*)?(.*)$`, "i"),
  );
}

function section(text: string, names: string[], following: string[]) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => headingMatch(line, names));
  if (start < 0) return "";
  const firstLine = headingMatch(lines[start], names)?.[1]?.trim() ?? "";
  const body: string[] = firstLine ? [firstLine] : [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (headingMatch(lines[index], following)) break;
    body.push(lines[index]);
  }
  return normalizeText(body.join("\n"));
}

export function parseResumeText(rawText: string): ParsedResumeText {
  const text = normalizeText(rawText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const headings = [
    "个人简介", "教育经历", "教育背景", "实习经历", "工作经历", "项目经历", "校园经历",
    "技能特长", "专业技能", "证书荣誉", "荣誉奖项", "自我评价", "作品链接",
  ];
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0] ?? "";
  const phone =
    text.match(/TEST[- ]?\d{3}[- ]?\d{4}/i)?.[0] ??
    text.match(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d(?:[- ]?\d){8}(?!\d)/)?.[0] ?? "";
  const name =
    lines.find((line) => /^姓名[:：]/.test(line))
      ?.replace(/^姓名[:：]\s*/, "") ??
    lines.find(
      (line) =>
        line.length >= 2 &&
        line.length <= 12 &&
        !headings.some((heading) => line.includes(heading)) &&
        !line.includes("@") &&
        !/\d{4}/.test(line),
    ) ?? "";
  const allFollowing = headings;
  return {
    rawText: text,
    name,
    email,
    phone,
    city:
      lines.find((line) => /^(?:所在地|城市)[:：]/.test(line))
        ?.replace(/^(?:所在地|城市)[:：]\s*/, "") ??
      lines.find((line) => /(?:北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|苏州)/.test(line))?.match(/北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|苏州/)?.[0] ?? "",
    summary: section(text, ["个人简介", "个人总结"], allFollowing),
    education: section(text, ["教育经历", "教育背景"], allFollowing),
    experience: section(text, ["实习经历", "工作经历"], allFollowing),
    project: section(text, ["项目经历"], allFollowing),
    campus: section(text, ["校园经历"], allFollowing),
    skills: section(text, ["技能特长", "专业技能", "技能"], allFollowing),
    certificate: section(text, ["证书荣誉", "荣誉奖项", "证书"], allFollowing),
    evaluation: section(text, ["自我评价"], allFollowing),
    portfolio: section(text, ["作品链接", "作品展示"], allFollowing),
  };
}

export async function extractResumeText(
  file: File,
  onProgress?: (value: number) => void,
) {
  validateImportFile(file);
  const lower = file.name.toLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return readPdf(file);
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return readDocx(file);
  }
  if (file.type.startsWith("image/")) return readImage(file, onProgress);
  if (lower.endsWith(".txt")) return normalizeText(await file.text());
  throw new Error("目前支持 PDF、DOCX、TXT、JPG 和 PNG");
}

export function validateImportFile(
  file: Pick<File, "name" | "type" | "size">,
) {
  const lower = file.name.toLowerCase();
  const isImage = file.type.startsWith("image/") || /\.(?:png|jpe?g)$/.test(lower);
  const limit = isImage ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > limit) {
    throw new Error(
      isImage
        ? "图片不能超过 10 MB，请先压缩后再导入"
        : "文件不能超过 20 MB，请拆分或压缩后再导入",
    );
  }
}
