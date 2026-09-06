import * as pdfjs from "./pdf.min.mjs";

globalThis.__ZHITU_PDFJS_MODULE__ = pdfjs;
globalThis.dispatchEvent(new CustomEvent("zhitu:pdfjs-ready"));
