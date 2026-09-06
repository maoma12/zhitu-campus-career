"use client";

export type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
};

export type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(input: { data: ArrayBuffer }): {
    promise: Promise<{
      numPages: number;
      getPage(page: number): Promise<{
        getTextContent(): Promise<{ items: PdfTextItem[] }>;
      }>;
    }>;
  };
};

type ModuleLoaderOptions<T> = {
  getLoaded: () => T | undefined;
  load: () => Promise<T>;
};

export function createConcurrentModuleLoader<T>({
  getLoaded,
  load,
}: ModuleLoaderOptions<T>) {
  let pending: Promise<T> | null = null;

  return () => {
    const loaded = getLoaded();
    if (loaded) return Promise.resolve(loaded);
    if (pending) return pending;

    pending = load().catch((error) => {
      // A failed public module request must not poison later retries.
      pending = null;
      throw error;
    });
    return pending;
  };
}

declare global {
  interface Window {
    __ZHITU_PDFJS_MODULE__?: PdfJsModule;
  }
}

const BRIDGE_ID = "zhitu-pdfjs-module-bridge";
const BRIDGE_URL = "/vendor/pdfjs/pdfjs-bridge.mjs";
const READY_EVENT = "zhitu:pdfjs-ready";
const LOAD_TIMEOUT_MS = 15_000;

function injectPdfJsBridge() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("PDFJS_BROWSER_REQUIRED"));
  }

  return new Promise<PdfJsModule>((resolve, reject) => {
    let script = document.getElementById(BRIDGE_ID) as HTMLScriptElement | null;
    let timeoutId = 0;

    const cleanupListeners = () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(READY_EVENT, handleReady);
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
    const fail = (reason: string) => {
      cleanupListeners();
      script?.remove();
      reject(new Error(reason));
    };
    const finish = () => {
      const pdfjs = window.__ZHITU_PDFJS_MODULE__;
      if (!pdfjs) {
        fail("PDFJS_BRIDGE_MISSING_MODULE");
        return;
      }
      cleanupListeners();
      resolve(pdfjs);
    };
    function handleReady() {
      finish();
    }
    function handleLoad() {
      finish();
    }
    function handleError() {
      fail("PDFJS_BRIDGE_LOAD_FAILED");
    }

    window.addEventListener(READY_EVENT, handleReady, { once: true });
    if (!script) {
      script = document.createElement("script");
      script.id = BRIDGE_ID;
      script.type = "module";
      script.src = BRIDGE_URL;
      document.head.append(script);
    }
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    timeoutId = window.setTimeout(
      () => fail("PDFJS_BRIDGE_LOAD_TIMEOUT"),
      LOAD_TIMEOUT_MS,
    );
  });
}

export const loadPdfJsModule = createConcurrentModuleLoader<PdfJsModule>({
  getLoaded: () =>
    typeof window === "undefined" ? undefined : window.__ZHITU_PDFJS_MODULE__,
  load: injectPdfJsBridge,
});

export function toResumeImportUserMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/PDFJS_|dynamically imported module|vendor\/pdfjs/i.test(message)) {
    return "PDF 解析组件加载失败，请刷新后重试；文件未上传，当前简历未被覆盖。";
  }
  return error instanceof Error && error.message
    ? error.message
    : "文件解析失败，请换一种格式重试；当前简历未被覆盖。";
}
